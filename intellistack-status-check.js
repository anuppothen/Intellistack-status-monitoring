/**
 * New Relic Synthetics - Scripted Browser monitor
 * Monitor name: Intellistack Status Check
 *
 * Scrapes every component on https://www.intellistackstatus.com/ (an Atlassian
 * Statuspage) and posts one 'IntellistackStatus' custom event per component to
 * New Relic via the Event API.
 *
 * Required secure credentials (Synthetics > Secure credentials):
 *   NR_INSERT_KEY   - New Relic License/Insert key (Ingest - License)
 *   NR_ACCOUNT_ID   - New Relic account ID
 * Optional:
 *   NR_REGION       - 'EU' to use the EU datacenter (default US)
 */
var assert = require('assert');
var https = require('https');

var STATUS_URL = 'https://www.intellistackstatus.com/';
var EVENT_TYPE = 'IntellistackStatus';

var accountId = $secure.NR_ACCOUNT_ID;
var insertKey = $secure.NR_INSERT_KEY;
var collector = ($secure.NR_REGION || '').toUpperCase() === 'EU'
  ? 'insights-collector.eu01.nr-data.net'
  : 'insights-collector.newrelic.com';

// Runs in the browser: returns one record per component (groups and children).
function scrapeComponents() {
  var out = [];
  var nodes = document.querySelectorAll('.component-inner-container[data-component-id]');
  Array.prototype.forEach.call(nodes, function (node) {
    var nameEl = node.querySelector('.name');
    var statusEl = node.querySelector('.component-status');
    var parentContainer = node.closest('.child-components-container');
    var groupName = null;
    if (parentContainer) {
      var groupNode = parentContainer.parentElement.querySelector('.component-inner-container .name');
      groupName = groupNode ? groupNode.textContent.replace(/\s+/g, ' ').trim() : null;
    }
    out.push({
      componentId: node.getAttribute('data-component-id'),
      name: nameEl ? nameEl.textContent.replace(/\s+/g, ' ').trim() : '',
      statusCode: node.getAttribute('data-component-status'),
      statusText: statusEl ? statusEl.textContent.replace(/\s+/g, ' ').trim() : '',
      isGroup: node.getAttribute('data-js-hook') === 'component-group-opener',
      group: groupName
    });
  });
  return out;
}

function postEvents(events) {
  return new Promise(function (resolve, reject) {
    var payload = JSON.stringify(events);
    var req = https.request({
      hostname: collector,
      path: '/v1/accounts/' + accountId + '/events',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Insert-Key': insertKey
      }
    }, function (res) {
      var body = '';
      res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () {
        if (res.statusCode < 200 || res.statusCode > 299) {
          return reject(new Error('Event API returned ' + res.statusCode + ': ' + body));
        }
        resolve();
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async function () {
  assert.ok(accountId && insertKey, 'Missing secure credentials NR_ACCOUNT_ID / NR_INSERT_KEY');

  await $browser.get(STATUS_URL);
  await $browser.waitForAndFindElement($driver.By.css('.component-inner-container[data-component-id]'), 30000);

  var components = await $browser.executeScript(scrapeComponents);
  assert.ok(components && components.length > 0, 'No components found on status page');

  var overallEl = await $browser.findElements($driver.By.css('.page-status .status'));
  var overallStatus = overallEl.length ? (await overallEl[0].getText()).trim() : null;

  var now = Date.now();
  var events = components.map(function (c) {
    return {
      eventType: EVENT_TYPE,
      timestamp: Math.floor(now / 1000),
      componentId: c.componentId,
      componentName: c.name,
      parentGroup: c.group,
      isGroup: c.isGroup,
      status: c.statusCode,            // operational, degraded_performance, partial_outage, major_outage, under_maintenance
      statusText: c.statusText,        // human-readable e.g. "Operational"
      isOperational: c.statusCode === 'operational',
      overallStatus: overallStatus,
      monitorName: 'Intellistack Status Check',
      sourceUrl: STATUS_URL
    };
  });

  // Log every component as: Parent Group - Component Name - Status
  events.forEach(function (e) {
    console.log((e.parentGroup || 'Top Level') + ' - ' + e.componentName + ' - ' + e.statusText + ' (' + e.status + ')');
  });

  // Event API accepts up to 1MB per payload; chunk to stay well under it.
  for (var i = 0; i < events.length; i += 200) {
    await postEvents(events.slice(i, i + 200));
  }
  console.log('Sent ' + events.length + ' ' + EVENT_TYPE + ' events');

  // Fail the monitor if any component is not operational. Done after posting
  // so the events are always recorded, including during an incident.
  var notOperational = events.filter(function (e) { return !e.isOperational; });
  assert.strictEqual(
    notOperational.length, 0,
    notOperational.length + ' component(s) not operational: ' +
      notOperational.map(function (e) {
        return (e.parentGroup || 'Top Level') + ' - ' + e.componentName + ' - ' + e.statusText;
      }).join('; ')
  );
})();
