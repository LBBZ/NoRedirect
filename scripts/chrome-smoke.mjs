const port = process.env.TEST_CHROME_PORT ?? "9334";
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const workers = targets.filter((target) => target.type === "service_worker");

async function evaluate(worker, expression) {
  const socket = new WebSocket(worker.webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  });
  const response = await new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    socket.send(JSON.stringify({
      id,
      method: "Runtime.evaluate",
      params: { awaitPromise: true, expression, returnByValue: true },
    }));
  });
  socket.close();
  return response;
}

let extensionWorker;
for (const worker of workers) {
  const probe = await evaluate(worker, "chrome.runtime.getManifest().name");
  if (probe.result?.result?.value === "NoRedirect") {
    extensionWorker = worker;
    break;
  }
}

if (!extensionWorker) {
  throw new Error("NoRedirect is not loaded or its service worker is not active");
}

const response = await evaluate(extensionWorker, String.raw`(async () => ({
  enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets(),
  manifestName: chrome.runtime.getManifest().name,
  optionsAvailable: (await fetch(chrome.runtime.getURL("src/options/options.html"))).ok,
  popupAvailable: (await fetch(chrome.runtime.getURL("src/popup/popup.html"))).ok,
  settings: await chrome.storage.local.get({ enabled: true })
}))()`);
if (response.result?.exceptionDetails) {
  throw new Error(response.result.exceptionDetails.text);
}
const result = response.result?.result?.value;
if (result?.manifestName !== "NoRedirect" ||
    !result.enabledRulesets?.includes("network_protection") ||
    !result.optionsAvailable ||
    !result.popupAvailable ||
    result.settings?.enabled !== true) {
  throw new Error(`Unexpected extension state: ${JSON.stringify(result)}`);
}

console.log(JSON.stringify(result, null, 2));
