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

/******************* CONFIGURATION *******************/
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
console.log('Starting inventory collector...');

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

let ASM_EP_RES_FLT = process.env.ASM_EP_RES_FLT;
if (!ASM_EP_RES_FLT) {
  console.error('Missing env variable ASM_EP_RES_FLT! Using default...');
  ASM_EP_RES_FLT =
    '?_filter=entityTypes%3DnetworkDevice&_field=name&_include_global_resources=false&_include_count=false&_include_status=false&_include_status_severity=false&_include_metadata=false&_return_composites=true';
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

let ASM_EP_RES_DEL_IMMEDIATE_PARAM = process.env.ASM_EP_RES_DEL_IMMEDIATE_PARAM;
if (!ASM_EP_RES_DEL_IMMEDIATE_PARAM) {
  console.error('Missing env variable ASM_EP_RES_DEL_IMMEDIATE_PARAM! Using default...');
  ASM_EP_RES_DEL_IMMEDIATE_PARAM = '?_immediate=true';
}

let ASM_ENTITY_TYPE = process.env.ASM_ENTITY_TYPE;
if (!ASM_ENTITY_TYPE) {
  console.error('Missing env variable ASM_ENTITY_TYPE! Using default...');
  ASM_ENTITY_TYPE = 'networkDevice';
}

ASM_EP_RES_FLT = ASM_EP_RES_FLT.replace('__ASM_ENTITY_TYPE__', ASM_ENTITY_TYPE);

const token = Buffer.from(`${ASM_USER}:${ASM_PASS}`, 'utf8').toString('base64');

/***************** END CONFIGURATION *******************/

//schedule a periodic run
cron.schedule(process.env.SCHEDULE || '* * * * *', () => {
  console.log(getCurrentDate() + '  Looking for new data in inventory database...');
  console.log(`Collecting current ressources from ASM, using filter on type <${ASM_ENTITY_TYPE}>`);
  getFromAsm()
    .then((data) => {
      entitiesInAsm = data;
      collectInventoryData();
    })
    .catch((err) => console.log(err));
});

// getFromAsm()
//   .then((data) => {
//     entitiesInAsm = data;
//     collectInventoryData();
//   })
//   .catch((err) => console.log(err));

async function collectInventoryData() {
  console.log(getCurrentDate() + ` Looking for new data using query <${INV_DB_QUERY_SQL}>`);

  let connection;
  try {
    connection = await oracledb.getConnection({
      user: INV_DB_USER,
      password: INV_DB_PW,
      connectString: INV_DB_CON,
    });

    const result = await connection.execute(INV_DB_QUERY_SQL, [], {
      resultSet: true,
    });

    if (result) {
      const rs = result.resultSet;
      let row;
      let i = 0;
      let invalidCount = 0;
      const invFieldsArray = INV_DB_QUERY_FIELDS.split(',');
      let entries = {};
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
        if (dataValid === true) entries[invEntry.ip] = invEntry;
        else {
          console.log(getCurrentDate() + ' The following entry contains invalid data:');
          console.log(invEntry);
          invalidCount++;
        }
        i++;
      }
      let summary = getCurrentDate() + ` Found ${i} rows in database.`;
      if (invalidCount > 0) summary += ` There were ${invalidCount} entrie(s), which had invalid data.`;
      console.log(summary);
      syncAsm(entries)
        .then(() => {
          sendToAsm(entries);
        })
        .catch((err) => console.log(err));

      await rs.close();
    } else {
      console.error(getCurrentDate() + ' Did not get any results from database!');
    }
  } catch (err) {
    console.error(err);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error(err);
      }
    }
  }
}

// gets a list of entities currently present in inventory and deletes the ressources
// in ASM if they are not present in inventory
async function syncAsm(invEntries) {
  return new Promise(function (resolve, reject) {
    console.log(getCurrentDate() + ' Synching inventory data with ASM...');
    try {
      for (const [key, value] of Object.entries(entitiesInAsm)) {
        console.log(key);
        let presentInInventory = invEntries[key];
        if (!presentInInventory) {
          console.log(getCurrentDate() + ' Element <' + key + '> is not present in inventory..');
          let asmElementInternalId = entitiesInAsm[key];
          if (asmElementInternalId) deleteFromAsm(key, asmElementInternalId);
        }
      }
      // Object.keys(entitiesInAsm).forEach(function (key) {
      //   let presentInInventory = invEntries[key];
      //   if (!presentInInventory) {
      //     console.log(getCurrentDate() + ' Element <' + key + '> is not present in inventory...');
      //     let asmElementInternalId = entitiesInAsm[key];
      //     if (asmElementInternalId) deleteFromAsm(key, asmElementInternalId);
      //   }
      // });
      resolve();
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while synchronizing inventory data with ASM!');
      console.error(err);
      reject(
        getCurrentDate() +
          'An Exception occurred while synchronizing inventory data with ASM. Please see previous error messages.'
      );
    }
  });
}

async function getFromAsm() {
  return new Promise(function (resolve, reject) {
    console.log(
      getCurrentDate() + ` Collecting current data from ASM using URL ${ASM_TOPO_URL + ASM_EP_RES + ASM_EP_RES_FLT} ...`
    );
    let asmEntries = {};
    try {
      axios
        .get(ASM_TOPO_URL + ASM_EP_RES + ASM_EP_RES_FLT, {
          headers: {
            Authorization: `Basic ${token}`,
            'X-TenantID': ASM_TENANT_ID,
          },
        })
        .then(
          (response) => {
            if (response && response.status && response.status < 400) {
              if (response.data && response.data._items) {
                for (let asmEle of response.data._items) {
                  asmEntries[asmEle.uniqueId] = asmEle._id;
                }
                console.log(
                  getCurrentDate() +
                    ` Done collecting current data from ASM. Found ${response.data._items.length} items.`
                );
                resolve(asmEntries);
              }
            }
          },
          (error) => {
            console.log(getCurrentDate() + ' Error collection data from ASM.');
            if (error && error.response && error.response.data) {
              const errorData = error.response.data;
              if (errorData) {
                console.log(`Reason:`);
                console.log(errorData);
                reject(
                  getCurrentDate() +
                    'An Error occurred while collection data from ASM. Please see previous error messages.'
                );
              }
            }
          }
        );
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while collection data from ASM!');
      console.error(err);
      reject(
        getCurrentDate() + ' An Exception occurred while collection data from ASM. Please see previous error messages.'
      );
    }
  });
}

async function sendToAsm(entries) {
  console.log(getCurrentDate() + ' Sending inventory data to ASM...');
  Object.keys(entries).forEach(function (key) {
    let ele = entries[key];
    ele.entityTypes = [ASM_ENTITY_TYPE];
    ele.uniqueId = ele.ip;
    ele.tags = ele.services_list.split(';');

    try {
      axios
        .post(ASM_BASE_URL + ASM_EP_RES, ele, {
          headers: {
            Authorization: `Basic ${token}`,
            'X-TenantID': ASM_TENANT_ID,
            JobId: ASM_EP_JOB_ID,
          },
        })
        .then(
          (response) => {
            if (response.status && response.status >= 400) {
              console.log(
                getCurrentDate() + ` Received an error response qhile create a ressource in ASM. Ressource: ${ele.ip}`
              );
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
          }
        );
    } catch (err) {
      console.log(getCurrentDate() + ' Caught an exception while sending data to ASM!');
      console.error(err);
    }
  });
}

async function deleteFromAsm(uniqueId, asmInternalId) {
  if (uniqueId && typeof uniqueId != 'undefined' && uniqueId != 'undefined') {
    console.log(uniqueId);
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
