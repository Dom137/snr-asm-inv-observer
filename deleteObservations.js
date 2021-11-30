/*
 * Copyright 2021 OpenAdvice IT Services GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * --------------------------------------------------------------------------------
 * Description: Delete observations found by a given observer.
 * --------------------------------------------------------------------------------
 */
const axios = require('axios');

const collectAsmDataAndPurge = function (user, pass, tenantId, observerName) {
  const token = Buffer.from(`${user}:${pass}`, 'utf8').toString('base64');
  for (const asmRes of asmRes2Del) {
    const resName = asmRes;

    console.log('----------------------');
    console.debug(`Deleting ressource with name: ${resName}`);
    const uri = encodeURI('https://192.168.12.226/1.0/topology/' + 'resources' + '/' + encodeURIComponent(resName));
    axios
      .delete(uri, {
        headers: {
          Authorization: `Basic ${token}`,
          'X-TenantID': tenantId,
          JobId: observerName,
        },
      })
      .then((response) => {
        if (response && response.status && response.status < 400) {
          console.debug(`Successfully deleted ressource with name: ${resName}.`);

          // that is always present, no need to check
          const resId = asmRes;
          // the previous delete is async, we need to wait a moment until we finally delete the elemet for good
          console.log('Waiting for ressource to be gone...');
          setTimeout(function () {
            console.debug(`Deleting ressource with name <${resName}> for good, using uniqueID <${resId}>`);
            const uri = encodeURI(
              'https://192.168.12.226/1.0/topology/' + 'resources' + '/' + resId + '?_immediate=true'
            );
            axios
              .delete(uri, {
                headers: {
                  Authorization: `Basic ${token}`,
                  'X-TenantID': tenantId,
                },
              })
              .then((response) => {
                if (response && response.status && response.status < 400) {
                  console.debug(`Successfully deleted ressource with name: ${resName}. for good.`);
                  console.log('----------------------');
                } else {
                  console.error(`Error deleting ressource with name: ${resName} immediately`);
                }
              })
              .catch((error) => {
                let message = `Error deleting ressource with name: ${resName} for good.`;
                //   console.log(error);
                if (error && error.response && error.response.data && error.response.data.message) {
                  message += ` Message from API: ${error.response.data.message}`;
                }
                console.error(message);
              });
          }, process.env.ASM_EP_DEL_WAIT_TIME_MS);
        } else {
          console.error(`Error deleting ressource with name: ${resName}. Response code gt 400`);
        }
      })
      .catch((error) => {
        const message = `Error deleting ressource with name: ${resName}`;
        console.error(message);
        console.log(error);
      });
  }
};

asmRes2Del = [
  'KP_2-BrVQDqAwtDKSCKFDA',
  'DTcdgRrBSTyRuMRI_KHsQw',
  'zp2HBp3bTNSlvH4XdRqB1w',
  'KPeiVWg9TXykMYHzRhN9Hw',
  'X1WNRiwfQ4OtDSMuO54xYg',
  'vgZOpKslS8ytGC7AYpEIAA',
  'UU49ISixT5yDjj-tI14d5w',
  'MOyy4sLeQiKXXx2kC297BA',
  'ZybHdUxCQg6Ox8oGKEnq7g',
  'LCjVdgGrRt6nHSrQN15nig',
  'fDK0HfBoSge9NoJczoAwMQ',
  'nYUDeOQgRkycrBf2Bbn1Kw',
  'bOZR4zSmTaqqaas9ftWwag',
  '2fZEcClFQdWO2RyDqiReOA',
  'BuDQ6ZqCRN2bTdF4DOFdEg',
  'j8J6BFjAQye8pWZatOz7Gw',
  '3byPMT1vSY-wxGxTEthvAQ',
];

collectAsmDataAndPurge('asm', 'asm', 'cfd95b7e-3bc7-4006-a4a8-a73a79c71255', 'snr_inventory');
