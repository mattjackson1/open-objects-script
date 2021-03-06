const { default: axios } = require('axios');
const util = require('util');

const { Http404Error, IminValidationError } = require('./errors');
const { log } = require('./log');

/**
 * @param {string} pageUrl
 * @param {string} apiKey
 */
async function getFirehosePage(pageUrl, apiKey) {
  // ## Download the page
  const headers = apiKey ? { 'x-api-key': apiKey } : {};
  const rpdePage = await axios(pageUrl, {
    validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
    // HTTP 404 is allowed so that we can assign special treatment
    timeout: 10000,
    headers,
  });
  if (rpdePage.status === 404) {
    throw new Http404Error(pageUrl);
  }
  // ## Validate the page
  if (typeof rpdePage.data.next !== 'string' || !rpdePage.data.next) {
    throw new IminValidationError(`RPDE .next should be a non-empty string. Value: ${util.inspect(rpdePage.data.next)}`);
  }
  if (!Array.isArray(rpdePage.data.items)) {
    throw new IminValidationError(`RPDE .items should be an array. Value: ${util.inspect(rpdePage.data.items)}`);
  }
  // use findIndex() rather than find() because find() returns `undefined`
  // for "not found", which is indistinguishable from "i found one and it is
  // undefined". We also want to validate that no items are undefined
  const invalidItemIndex = rpdePage.data.items.findIndex((item) => !item || (item.state !== 'updated' && item.state !== 'deleted'));
  if (invalidItemIndex > 0) {
    const invalidItem = rpdePage.data.items[invalidItemIndex];
    const invalidItemId = invalidItem && invalidItem.id;
    throw new IminValidationError(`item [index: "${invalidItemIndex}" ; id: "${invalidItemId}"] should be non-null and have state=updated|deleted. It does not`);
  }
  log('info', `getFirehosePage() - Downloaded ${pageUrl}. Num items: ${rpdePage.data.items.length}`);

  return { nextNextUrl: rpdePage.data.next, items: rpdePage.data.items };
}

module.exports = {
  getFirehosePage,
};
