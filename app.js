/*
 * Copyright 2021 @OpenAdvice
 * Author: Dominic Lehr
/*
 * --------------------------------------------------------------------------------
 * Description: Main Module for the inventory observer
 *        TODO:
 * --------------------------------------------------------------------------------
 */

const cron = require('node-cron');
const axios = require('axios');
const oracledb = require('oracledb');

const { getCurrentDate, validateIPaddress } = require('./helperFunctions');

let entitiesInAsm = {};
let nodeIdToUniqueId = {};

/******************* CONFIGURATION *******************/
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
console.log(getCurrentDate() + ' Starting inventory collector...');

let INV_DB_QUERY_FIELDS = process.env.INV_DB_QUERY_FIELDS;
if (!INV_DB_QUERY_FIELDS) {
  INV_DB_QUERY_FIELDS =
    'IP,NAME,PROVISION_STATUS,NODE_TYPE,NODE_DEF,NETWORKFUNCTION,TREE,STABLENET_AGENT,STABLENET_PMAGENT,SERVICES_LIST,SMON_TAG';
}

let INV_DB_NAME = process.env.INV_DB_NAME;
if (!INV_DB_NAME) {
  INV_DB_NAME = 'INVENTORY';
}

let INV_DB_QUERY_SQL = process.env.INV_DB_QUERY_SQL;
if (!INV_DB_QUERY_SQL) {
  INV_DB_QUERY_SQL = 'select __INV_DB_QUERY_FIELDS__ from __INV_DB_NAME__';
}

INV_DB_QUERY_SQL = INV_DB_QUERY_SQL.replace('__INV_DB_QUERY_FIELDS__', INV_DB_QUERY_FIELDS);
INV_DB_QUERY_SQL = INV_DB_QUERY_SQL.replace('__INV_DB_NAME__', INV_DB_NAME);

console.log(`Using query <${INV_DB_QUERY_SQL}> to query database...`);

let INV_DB_CON = process.env.INV_DB_CON;
if (!INV_DB_CON) {
  console.error('Missing env variable INV_DB_CON! Using default...');
  INV_DB_CON = '127.0.0.1:1521/XE';
}

let INV_DB_USER = process.env.INV_DB_USER;
if (!INV_DB_USER) {
  console.error('Missing env variable INV_DB_USER! Using default...');
  INV_DB_USER = 'sunrise';
}

let INV_DB_PW = process.env.INV_DB_PW;
if (!INV_DB_PW) {
  console.error('Missing env variable INV_DB_PW! Using default...');
  INV_DB_PW = 'oadvice';
}

let IFACE_DB_QUERY_FIELDS = process.env.IFACE_DB_QUERY_FIELDS;
if (!IFACE_DB_QUERY_FIELDS) {
  IFACE_DB_QUERY_FIELDS =
    'PHYSICALPORTID,IF2NODEID,IF2MODULECARDID,IF_NAME,PHYSICALPORT_PROV_STATUS,BANDWIDTH_CALC,FAR_END_LOOPBACK,FAR_END_DEVICE_NAME,FAR_END_NODEID,FAR_END_NETWORKFUNCTION,FAR_END_HIERARCHY_CALC,FAR_END_IF_NAME,FAR_END_PHYSICALPORTID,CRAMER_CIRCUIT_NAME,CRAMER_CIRCUIT_TYPE,TRANSPORT_MEDIA_CALC,IDN_SERVICE,FX_SUN_VLAN,CIRCUIT_BANDWIDTH_KBPS,SERVICES_LIST';
}

let IFACE_DB_NAME = process.env.IFACE_DB_NAME;
if (!IFACE_DB_NAME) {
  IFACE_DB_NAME = 'V_STABLENET_PHYSICAL_INTERFACE';
}

let IFACE_DB_QUERY_SQL = process.env.IFACE_DB_QUERY_SQL;
if (!IFACE_DB_QUERY_SQL) {
  IFACE_DB_QUERY_SQL = 'select __IFACE_DB_QUERY_FIELDS__ from __IFACE_DB_NAME__';
}

IFACE_DB_QUERY_SQL = IFACE_DB_QUERY_SQL.replace('__IFACE_DB_QUERY_FIELDS__', IFACE_DB_QUERY_FIELDS);
IFACE_DB_QUERY_SQL = IFACE_DB_QUERY_SQL.replace('__IFACE_DB_NAME__', IFACE_DB_NAME);

console.log(`Using query <${IFACE_DB_QUERY_SQL}> to query interfaces database...`);

let IFACE_DB_CON = process.env.IFACE_DB_CON;
if (!IFACE_DB_CON) {
  console.error('Missing env variable IFACE_DB_CON! Using default...');
  IFACE_DB_CON =
    '(DESCRIPTION =(ADDRESS = (PROTOCOL = TCP)(HOST = 192.168.12.189)(PORT = 1521))(CONNECT_DATA =(SID= ORCL)))';
}

let IFACE_DB_USER = process.env.IFACE_DB_USER;
if (!IFACE_DB_USER) {
  console.error('Missing env variable IFACE_DB_USER! Using default...');
  IFACE_DB_USER = 'sunrise';
}

let IFACE_DB_PW = process.env.IFACE_DB_PW;
if (!IFACE_DB_PW) {
  console.error('Missing env variable IFACE_DB_PW! Using default...');
  IFACE_DB_PW = 'oadvice';
}

let ASM_BASE_URL = process.env.ASM_BASE_URL;
if (!ASM_BASE_URL) {
  console.error('Missing env variable ASM_BASE_URL! Using default...');
  ASM_BASE_URL = 'https://192.168.12.226/1.0/rest-observer/rest/';
}

let ASM_TOPO_URL = process.env.ASM_TOPO_URL;
if (!ASM_TOPO_URL) {
  console.error('Missing env variable ASM_TOPO_URL! Using default...');
  ASM_TOPO_URL = 'https://192.168.12.226/1.0/topology/';
}

let ASM_USER = process.env.ASM_USER;
if (!ASM_USER) {
  console.error('Missing env variable ASM_USER! Using default...');
  ASM_USER = 'asm';
}

let ASM_PASS = process.env.ASM_PASS;
if (!ASM_PASS) {
  console.error('Missing env variable ASM_PASS! Using default...');
  ASM_PASS = 'asm';
}

let ASM_TENANT_ID = process.env.ASM_TENANT_ID;
if (!ASM_TENANT_ID) {
  console.error('Missing env variable ASM_TENANT_ID! Using default...');
  ASM_TENANT_ID = 'cfd95b7e-3bc7-4006-a4a8-a73a79c71255';
}

let ASM_EP_JOB_ID = process.env.ASM_EP_JOB_ID;
if (!ASM_EP_JOB_ID) {
  console.error('Missing env variable ASM_EP_JOB_ID! Using default...');
  ASM_EP_JOB_ID = 'snr_inventory';
}

let ASM_EP_RES = process.env.ASM_EP_RES;
if (!ASM_EP_RES) {
  console.error('Missing env variable ASM_EP_RES! Using default...');
  ASM_EP_RES = 'resources';
}

let ASM_EP_REF = process.env.ASM_EP_REF;
if (!ASM_EP_REF) {
  console.error('Missing env variable ASM_EP_REF! Using default...');
  ASM_EP_REF = 'references';
}

let ASM_EP_RES_FLT = process.env.ASM_EP_RES_FLT;
if (!ASM_EP_RES_FLT) {
  console.error('Missing env variable ASM_EP_RES_FLT! Using default...');
  ASM_EP_RES_FLT =
    '?_filter=entityTypes%3DnetworkDevice&_limit=__LIMIT__&_offset=__OFFSET__&_sort=+uniqueId&_field=uniqueId&_include_global_resources=false&_include_count=false&_include_status=false&_include_status_severity=false&_include_metadata=false&_return_composites=true';
}

let ASM_EP_RES_CNT = process.env.ASM_EP_RES_CNT;
if (!ASM_EP_RES_CNT) {
  console.error('Missing env variable ASM_EP_RES_CNT! Using default...');
  ASM_EP_RES_CNT =
    '?_filter=entityTypes%3DnetworkDevice&_limit=1&_include_global_resources=false&_include_count=true&_include_status=false&_include_status_severity=false&_include_metadata=false&_return_composites=true';
}

let DELETE_IF_NOT_PRESENT_IN_INV = process.env.DELETE_IF_NOT_PRESENT_IN_INV == 'true' ? true : false;
if (typeof DELETE_IF_NOT_PRESENT_IN_INV === 'undefined') {
  console.error('Missing env variable DELETE_IF_NOT_PRESENT_IN_INV! Using default...');
  DELETE_IF_NOT_PRESENT_IN_INV = true;
}

let ASM_EP_RES_DEL_IMMEDIATE = process.env.ASM_EP_RES_DEL_IMMEDIATE == 'true' ? true : false;
if (typeof ASM_EP_RES_DEL_IMMEDIATE === 'undefined') {
  console.error('Missing env variable ASM_EP_RES_DEL_IMMEDIATE! Using default...');
  ASM_EP_RES_DEL_IMMEDIATE = true;
}

let ASM_EP_DEL_WAIT_TIME_MS = process.env.ASM_EP_DEL_WAIT_TIME_MS;
if (!ASM_EP_DEL_WAIT_TIME_MS) {
  console.error('Missing env variable ASM_EP_DEL_WAIT_TIME_MS! Using default...');
  ASM_EP_DEL_WAIT_TIME_MS = 6000;
} else {
  ASM_EP_DEL_WAIT_TIME_MS = parseInt(ASM_EP_DEL_WAIT_TIME_MS);
}

let ASM_BATCH_SIZE = process.env.ASM_BATCH_SIZE;
if (!ASM_BATCH_SIZE) {
  console.error('Missing env variable ASM_BATCH_SIZE! Using default...');
  ASM_BATCH_SIZE = 1000;
} else {
  ASM_BATCH_SIZE = parseInt(ASM_BATCH_SIZE);
}

let ASM_EP_RES_DEL_IMMEDIATE_PARAM = process.env.ASM_EP_RES_DEL_IMMEDIATE_PARAM;
if (!ASM_EP_RES_DEL_IMMEDIATE_PARAM) {
  console.error('Missing env variable ASM_EP_RES_DEL_IMMEDIATE_PARAM! Using default...');
  ASM_EP_RES_DEL_IMMEDIATE_PARAM = '?_immediate=true';
}

let ASM_EP_REF_DEL = process.env.ASM_EP_REF_DEL;
if (!ASM_EP_REF_DEL) {
  console.error('Missing env variable ASM_EP_REF_DEL! Using default...');
  ASM_EP_REF_DEL = '/references/out/contains?_delete=nodes&_delete_self=false';
}

let ASM_ENTITY_TYPE = process.env.ASM_ENTITY_TYPE;
if (!ASM_ENTITY_TYPE) {
  console.error('Missing env variable ASM_ENTITY_TYPE! Using default...');
  ASM_ENTITY_TYPE = 'networkDevice';
}

let ASM_ENTITY_TYPE_INTERFACE = process.env.ASM_ENTITY_TYPE_INTERFACE;
if (!ASM_ENTITY_TYPE_INTERFACE) {
  console.error('Missing env variable ASM_ENTITY_TYPE_INTERFACE! Using default...');
  ASM_ENTITY_TYPE_INTERFACE = 'networkInterface';
}

ASM_EP_RES_FLT = ASM_EP_RES_FLT.replace('__ASM_ENTITY_TYPE__', ASM_ENTITY_TYPE);
ASM_EP_RES_CNT = ASM_EP_RES_CNT.replace('__ASM_ENTITY_TYPE__', ASM_ENTITY_TYPE);

let ASM_RESPONSE_TIMEOUT = process.env.ASM_RESPONSE_TIMEOUT;
if (!ASM_RESPONSE_TIMEOUT) {
  console.error('Missing env variable ASM_RESPONSE_TIMEOUT! Using default...');
  ASM_RESPONSE_TIMEOUT = 10000;
} else {
  ASM_RESPONSE_TIMEOUT = parseInt(ASM_RESPONSE_TIMEOUT);
}

const token = Buffer.from(`${ASM_USER}:${ASM_PASS}`, 'utf8').toString('base64');

/***************** END CONFIGURATION *******************/

//schedule a periodic run
// cron.schedule(process.env.SCHEDULE || '*/30 * * * *', () => {
//   console.log(getCurrentDate() + '  Looking for new data in inventory database...');
//   console.log(getCurrentDate() + ` Collecting current ressources from ASM, using filter on type <${ASM_ENTITY_TYPE}>`);
//   getAsmRessourceCount()
//     .then((cnt) => {
//       getFromAsm(cnt)
//         .then((data) => {
//           entitiesInAsm = data;

//           collectInventoryData(INV_DB_QUERY_SQL, INV_DB_USER, INV_DB_PW, INV_DB_CON, INV_DB_QUERY_FIELDS).then(
//             (elements) => {
//               syncAsm(elements)
//                 .then(() => {
//                   sendToAsm(elements);
//                 })
//                 .catch((err) => console.log(err));
//             }
//           );
//         })
//         .catch((err) => console.log(err));
//     })
//     .catch((err) => console.log(err));
// });

getAsmRessourceCount()
  .then((cnt) => {
    getFromAsm(cnt)
      .then((data) => {
        entitiesInAsm = data;
        collectInventoryData(INV_DB_QUERY_SQL, INV_DB_USER, INV_DB_PW, INV_DB_CON, INV_DB_QUERY_FIELDS, false).then(
          (nodes) => {
            syncAsm(nodes)
              .then(() => {
                collectInventoryData(
                  IFACE_DB_QUERY_SQL,
                  IFACE_DB_USER,
                  IFACE_DB_PW,
                  IFACE_DB_CON,
                  IFACE_DB_QUERY_FIELDS,
                  true
                )
                  .then((interfaces) => {
                    sendToAsm(nodes, interfaces);
                  })
                  .catch((err) => console.log(err));
              })
              .catch((err) => console.log(err));
          }
        );
      })
      .catch((err) => console.log(err));
  })
  .catch((err) => console.log(err));

async function collectInventoryData(query, user, pw, con, fields, interfaces) {
  console.log(getCurrentDate() + ` Looking for new data using query <${query}>`);

  let tempData = {};
  return new Promise(async function (resolve, reject) {
    let connection;
    try {
      connection = await oracledb.getConnection({
        user: user,
        password: pw,
        connectString: con,
      });

      const result = await connection.execute(query, [], {
        resultSet: true,
      });

      if (result) {
        const rs = result.resultSet;
        let row;
        let i = 0;
        let invalidCount = 0;
        const invFieldsArray = fields.split(',');
        while ((row = await rs.getRow())) {
          let invEntry = {};
          let dataValid = true;
          for (const field of invFieldsArray) {
            let val = '' + row[field.trim()];
            val = val.trim();
            val = val.replace(/(?:\r\n|\r|\n)/g, ' ');
            if (field.toUpperCase() === 'IP') {
              if (validateIPaddress(val) === false) {
                dataValid = false;
              }
            }
            invEntry[field.toLowerCase()] = val;
          }
          if (dataValid === true) {
            if (interfaces === false) tempData[invEntry.ip] = invEntry;
            else tempData[invEntry.physicalportid] = invEntry;
          } else {
            console.log(getCurrentDate() + ' The following entry contains invalid data:');
            console.log(invEntry);
            invalidCount++;
          }
          i++;
        }
        let summary = getCurrentDate() + ` Found ${i} rows in database.`;
        if (invalidCount > 0) summary += ` There were ${invalidCount} entrie(s), which had invalid data.`;
        console.log(summary);

        await rs.close();
        resolve(tempData);
      } else {
        console.error(getCurrentDate() + ' Did not get any results from database!');
        reject('Did not get any results from database!');
      }
    } catch (err) {
      console.error(err);
      reject(err);
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch (err) {
          console.error(err);
        }
      }
    }
  });
}

async function getAsmRessourceCount() {
  return new Promise(function (resolve, reject) {
    console.log(
      getCurrentDate() +
        ` Collecting the total amount of ressources from ASM using URL ${
          ASM_TOPO_URL + ASM_EP_RES + ASM_EP_RES_CNT
        } ...`
    );
    try {
      axios
        .get(ASM_TOPO_URL + ASM_EP_RES + ASM_EP_RES_CNT, {
          headers: {
            Authorization: `Basic ${token}`,
            'X-TenantID': ASM_TENANT_ID,
          },
        })
        .then(
          (response) => {
            if (response && response.status && response.status < 400) {
              if (response.data && response.data._count >= 0) {
                const asmResCount = response.data._count;
                console.log(
                  getCurrentDate() + ` Done collecting total amount of ressources from ASM. Found ${asmResCount} items.`
                );
                resolve(asmResCount);
              } else {
                console.log(
                  getCurrentDate() +
                    ` Done collecting total amount of ressources from ASM. Found an unexpected count, returning 0.`
                );
                resolve(0);
              }
            }
          },
          (error) => {
            console.log(getCurrentDate() + ' Error collecting total amount of ressources from ASM.');
            console.log(error);
            if (error && error.response && error.response.data) {
              const errorData = error.response.data;
              if (errorData) {
                console.log(`Reason:`);
                console.log(errorData);
                reject(
                  getCurrentDate() +
                    'An Error occurred while collection total amount of ressources from ASM. Please see previous error messages.'
                );
              }
            }
          }
        );
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while collection total amount of ressources from ASM!');
      console.error(err);
      reject(
        getCurrentDate() +
          ' An Exception occurred while collection total amount of ressources from ASM. Please see previous error messages.'
      );
    }
  });
}

// gets a list of entities currently present in inventory and deletes the ressources
// in ASM if they are not present in inventory
// also removes all outgoing reference so that the interfaces' relations is always in sync
async function syncAsm(invEntries) {
  return new Promise(async function (resolve, reject) {
    console.log(getCurrentDate() + ' Synching inventory data with ASM...');
    let count = 0;
    try {
      for (const [key, value] of Object.entries(entitiesInAsm)) {
        let presentInInventory = invEntries[key];
        if (!presentInInventory) {
          console.log(getCurrentDate() + ' Element <' + key + '> is not present in inventory..');

          let asmElementInternalId = entitiesInAsm[key];
          if (asmElementInternalId) deleteFromAsm(key, asmElementInternalId);
        } else {
          try {
            await deleteReferenceFromAsm(value);
            count++;
            console.log(getCurrentDate() + ` Done deleting ressource relation #${count}.`);
          } catch (err) {
            console.log(getCurrentDate() + ' Caught an exception while deleting ressource relation.');
            console.error(err);
          }
        }
      }
      resolve();
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while synchronizing inventory data with ASM!');
      console.error(err);
      reject(
        getCurrentDate() +
          'An Exception occurred while synchronizing inventory data with ASM. Please see previous error message(s).'
      );
    }
  });
}

async function deleteReferenceFromAsm(eleAsmId) {
  return new Promise(async function (resolve, reject) {
    console.log(getCurrentDate() + ` Deleting references from ressource with ASM id ${eleAsmId}`);
    try {
      axios
        .delete(ASM_TOPO_URL + ASM_EP_RES + '/' + encodeURIComponent(eleAsmId) + ASM_EP_REF_DEL, {
          timeout: 5000,
          headers: {
            Authorization: `Basic ${token}`,
            'X-TenantID': ASM_TENANT_ID,
          },
        })
        .then(
          (response) => {
            if (response.status && response.status >= 400) {
              console.error(
                getCurrentDate() +
                  ` Received an error response while deleting a reference from ASM. Ressource: ${eleAsmId}`
              );
              reject(`Received an error response while deleting a reference from ASM. Ressource: ${eleAsmId}`);
            } else {
              console.log(getCurrentDate() + ' Successfully deleted refernece from ASM.');
              resolve();
            }
          },
          (error) => {
            console.error(getCurrentDate() + ' Error deleting a reference from ASM:');
            console.log(error);
            if (error && error.response && error.response.data) {
              const errorData = error.response.data;
              if (errorData) {
                if (errorData.message) console.log(getCurrentDate() + ` Reason: ${errorData.message}`);
              }
            }
            reject('Error deleting a reference from ASM.');
          }
        );
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while deleting a reference from ASM.!');
      console.error(err);
      reject('Caught an exception while deleting a reference from ASM.!');
    }
  });
}

async function getFromAsm(totalRessourceCnt) {
  // let numApiCalls = Math.ceil(totalRessourceCnt / ASM_BATCH_SIZE);
  let numApiCalls = 1;
  console.log(
    getCurrentDate() +
      ` Will be running ${numApiCalls} call(s) against the ASM API with a batch size of ${ASM_BATCH_SIZE} each.`
  );

  entitiesInAsm = {};
  nodeIdToUniqueId = {};

  const staticUrlPart = ASM_TOPO_URL + ASM_EP_RES;
  let dynamicUrlPart = '';
  let executedCalls = 0;
  let asmEntries = {};

  while (executedCalls < numApiCalls) {
    dynamicUrlPart = ASM_EP_RES_FLT.replace('__LIMIT__', ASM_BATCH_SIZE);
    dynamicUrlPart = dynamicUrlPart.replace('__OFFSET__', executedCalls * ASM_BATCH_SIZE);
    console.log(
      getCurrentDate() + ` Executing batch #${executedCalls + 1} using URL ${staticUrlPart + dynamicUrlPart}`
    );

    try {
      let response = await axios.get(staticUrlPart + dynamicUrlPart, {
        headers: {
          Authorization: `Basic ${token}`,
          'X-TenantID': ASM_TENANT_ID,
        },
      });
      if (response && response.status && response.status < 400) {
        if (response.data && response.data._items) {
          for (let asmEle of response.data._items) {
            asmEntries[asmEle.uniqueId] = asmEle._id;
            nodeIdToUniqueId[asmEle.nodeid] = asmEle.uniqueId;
          }
          console.log(
            getCurrentDate() +
              ` Done collecting batched data from ASM. Found ${response.data._items.length} items in current batch.`
          );
        }
      }
      executedCalls++;
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while collection data from ASM!');
      console.error(err);
    }
  }

  console.log(getCurrentDate() + ` Done collecting ALL data from ASM. Found ${Object.keys(asmEntries).length} items.`);
  return asmEntries;
}

async function sendToAsm(elements, interfaces) {
  console.log(getCurrentDate() + ' Sending node inventory data to ASM...');

  let nodeCount = 1;
  for (const [key, ele] of Object.entries(elements)) {
    try {
      ele.entityTypes = [ASM_ENTITY_TYPE];
      ele.uniqueId = ele.ip;
      ele.tags = ele.services_list.split(';');
      nodeCount = nodeCount + 1;
      console.log(getCurrentDate() + ` Working on element ${ele.ip}. This is element #${nodeCount}.`);
      await sendSingleElementToAsm(ele, ASM_EP_RES);
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while sending data to ASM!');
      console.error(err);
    }
  }
  console.log(getCurrentDate() + ' Done Sending node inventory data to ASM.');

  // interfaces: create them and build the relation to the node
  // while going over all interfaces, build a map to create the connections: physicalportid : FAR_END_NODEID
  console.log(getCurrentDate() + ' Sending interface inventory data to ASM...');
  let interfaceCount = 1;
  let interfaceConnections = {};
  for (const [key, interface] of Object.entries(interfaces)) {
    try {
      interface.entityTypes = [ASM_ENTITY_TYPE_INTERFACE];
      interface.uniqueId = interface.physicalportid;
      interface.name = interface.if_name;
      interface.tags = interface.services_list.split(';');
      interfaceCount = interfaceCount + 1;
      console.log(
        getCurrentDate() +
          ` Working on element ${interface.physicalportid}. This is interface element #${interfaceCount}.`
      );
      interfaceConnections[interface.physicalportid] = interface.far_end_physicalportid;
      await sendSingleElementToAsm(interface, ASM_EP_RES);

      // create the relation to the node
      console.log(
        getCurrentDate() +
          ` Created interface with PortId ${interface.physicalportid} in ASM. Building the contains relation...`
      );
      const containingDeviceUniqueId = nodeIdToUniqueId[interface.if2nodeid];
      if (containingDeviceUniqueId) {
        let containsRelation = {};
        containsRelation._fromUniqueId = containingDeviceUniqueId;
        containsRelation._toUniqueId = interface.physicalportid;
        containsRelation._edgeType = 'contains';
        await sendSingleElementToAsm(containsRelation, ASM_EP_REF);
      } else {
        console.log(
          getCurrentDate() +
            ` Interface with PortId ${interface.physicalportid} should be containted by device with NodeId ${interface.if2nodeid}, but this device is not present in ASM.`
        );
      }
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while sending data to ASM!');
      console.error(err);
    }
  }
  console.log(getCurrentDate() + ' Done Sending interface inventory data to ASM.');

  // create the connectivity to the other interface
  console.log(getCurrentDate() + ` Creating interface connectvity...`);
  let interfaceConnectionsCount = 1;
  for (const [srcInterface, dstInterface] of Object.entries(interfaceConnections)) {
    try {
      let srcDstRelation = {};
      srcDstRelation._fromUniqueId = srcInterface;
      srcDstRelation._toUniqueId = dstInterface;
      srcDstRelation._edgeType = 'connectedTo';
      interfaceConnectionsCount = interfaceConnectionsCount + 1;
      console.log(
        getCurrentDate() +
          ` Working on connectivity from source interface with PortId ${srcInterface} to interface ${dstInterface}. This is connectivity #${interfaceConnectionsCount}.`
      );
      await sendSingleElementToAsm(srcDstRelation, ASM_EP_REF);
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while sending data to ASM!');
      console.error(err);
    }
  }
  console.log(
    getCurrentDate() +
      ` Done creating interface connectvity. Created ${interfaceConnectionsCount} connections in total.`
  );
}

async function sendSingleElementToAsm(ele, endpoint) {
  return new Promise(async function (resolve, reject) {
    try {
      axios
        .post(ASM_BASE_URL + endpoint, ele, {
          timeout: ASM_RESPONSE_TIMEOUT,
          headers: {
            Authorization: `Basic ${token}`,
            'X-TenantID': ASM_TENANT_ID,
            JobId: ASM_EP_JOB_ID,
          },
        })
        .then(
          (response) => {
            console.log(getCurrentDate() + ' Sent to ASM... checking response (errors will be logged).');
            if (response.status && response.status >= 400) {
              console.log(
                getCurrentDate() +
                  ` Received an error response while creating a ressource in ASM. Ressource: ${ele.name}`
              );
              reject(`Received an error response while creating a ressource in ASM. Ressource: ${ele.name}`);
            } else {
              //console.log(getCurrentDate() + ' Successfully sent to ASM.');
              resolve();
            }
          },
          (error) => {
            console.log(getCurrentDate() + ' Error sending the following data to ASM:');
            console.log(ele);
            if (error && error.response && error.response.data) {
              const errorData = error.response.data;
              if (errorData) {
                console.log(getCurrentDate() + ` Reason:`);
                console.log(errorData);
              }
            }
            reject('Error sending data to ASM.');
          }
        );
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while sending data to ASM!');
      console.error(err);
      reject('Caught an exception while sending data to ASM!');
    }
  });
}

async function deleteFromAsm(uniqueId, asmInternalId) {
  if (uniqueId && typeof uniqueId != 'undefined' && uniqueId != 'undefined') {
    console.log(getCurrentDate() + ` About to delete ressource with uniqueId <${uniqueId}> from ASM...`);
    const uri = encodeURI(ASM_BASE_URL + ASM_EP_RES + '/' + uniqueId);
    axios
      .delete(uri, {
        headers: {
          Authorization: `Basic ${token}`,
          'X-TenantID': ASM_TENANT_ID,
          JobId: ASM_EP_JOB_ID,
        },
      })
      .then((response) => {
        if (response && response.status && response.status < 400) {
          console.log(getCurrentDate() + ` Done deleting ressource with uniqueId <${uniqueId}> from ASM...`);
          if (ASM_EP_RES_DEL_IMMEDIATE === true) {
            // the previous delete is async, we need to wait a moment until we finally delete the elemet for good
            console.log(getCurrentDate() + ' Waiting for ressource to be gone...');
            setTimeout(function () {
              console.debug(
                getCurrentDate() +
                  ` Deleting ressource with name <${uniqueId}> for good, using uniqueID <${asmInternalId}>`
              );
              const uri = encodeURI(ASM_TOPO_URL + ASM_EP_RES + '/' + asmInternalId + ASM_EP_RES_DEL_IMMEDIATE_PARAM);
              axios
                .delete(uri, {
                  headers: {
                    Authorization: `Basic ${token}`,
                    'X-TenantID': ASM_TENANT_ID,
                  },
                })
                .then((response) => {
                  if (response && response.status && response.status < 400) {
                    console.debug(
                      getCurrentDate() + ` Successfully deleted ressource with name: ${uniqueId}. for good.`
                    );
                    console.log('----------------------');
                  } else {
                    console.error(getCurrentDate() + ` Error deleting ressource with name: ${uniqueId} immediately`);
                  }
                })
                .catch((error) => {
                  let message = getCurrentDate() + ` Error deleting ressource with name: ${uniqueId} for good.`;
                  //   console.log(error);
                  if (error && error.response && error.response.data && error.response.data.message) {
                    message += getCurrentDate() + `  Message from API: ${error.response.data.message}`;
                  }
                  console.error(message);
                });
            }, ASM_EP_DEL_WAIT_TIME_MS);
          }
        } else {
          console.error(getCurrentDate() + ` Error deleting ressource with name: ${uniqueId}. Response code gt 400`);
        }
      })
      .catch((error) => {
        const message = getCurrentDate() + ` Error deleting ressource with name: ${uniqueId}`;
        console.error(message);
        console.log(error);
      });
  }
}
