import { NAME_ELEMENT_SELECTOR } from '../constants';
import { DomElementmetadata } from '../state/currentTask';
import { useAppState } from '../state/store';
import { callRPC } from './pageRPC';
import { getAttrString, scrollScriptString } from './runtimeFunctionStrings';
import { sleep } from './utils';

const IGNORED_ACTREE_PROPERTIES: readonly string[] = [
  "focusable",
  "editable",
  "readonly",
  "level",
  "settable",
  "multiline",
  "invalid",
];

interface AttributeValue {
  type: string;
  value: string;
}

interface Source {
  attribute: string;
  attributeValue?: AttributeValue;
  invalid?: boolean;
  type: string;
}

interface Name {
  sources: Source[];
  type: string;
  value: string;
}

interface Node {
  nodeId: string;
  role: { value: string };
  name: Name;
  properties?: Array<{ name: string; value: { value: any } }>;
  backendDOMNodeId?: number;
  union_bound?: number[];
  childIds: string[];
  parentId?: string;
  unique_id?: string; // used for mapping
}

let axTree: Node[] = [];
const flagDictionary: number[] = [];
const operateonAxTree = true;
const Debug = false;
const flagforcurrentViewportOnly = true;
let treecontent: string;

async function sendCommand(method: string, params?: any) {
  const tabId = useAppState.getState().currentTask.tabId;
  return chrome.debugger.sendCommand({ tabId }, method, params);
}

async function getObjectId(originalId: number) {

  let uniqueId = '';
  if (operateonAxTree)
  {
    // since we passed the id itself, we can use it directly.
    uniqueId = originalId.toString();
  }
  else{
    uniqueId = await callRPC('getUniqueElementSelectorId', [originalId]) as string;
  }
  // get node id
  const document = (await sendCommand('DOM.getDocument')) as any;
  const { nodeId } = (await sendCommand('DOM.querySelector', {
    nodeId: document.root.nodeId,
    selector: `[${NAME_ELEMENT_SELECTOR}="${uniqueId}"]`,
  })) as any;
  if (!nodeId) {
    throw new Error('Could not find node');
  }

  // get object id
  const result = (await sendCommand('DOM.resolveNode', { nodeId })) as any;
  const objectId = result.object.objectId;
  if (!objectId) {
    throw new Error('Could not find object');
  }
  return objectId;
}

async function scrollIntoView(objectId: string) {
  await sendCommand('Runtime.callFunctionOn', {
    objectId,
    functionDeclaration: scrollScriptString,
  });
  await sleep(delayBetweenClicks);
}

async function scrollIntoDirection(direction: string) {
  await sendCommand('Runtime.callFunctionOn', {
    direction,
    functionDeclaration: scrollDirectionScriptString,
  });
  await sleep(delayBetweenClicks);
}

async function getCenterCoordinates(objectId: string) {
  const { model } = (await sendCommand('DOM.getBoxModel', { objectId })) as any;
  if (!model) {
    throw new Error('Could not find boxmodel');
  }
  const [x1, y1, x2, y2, x3, y3, x4, y4] = model.border;
  const centerX = (x1 + x3) / 2;
  const centerY = (y1 + y3) / 2;
  return { x: centerX, y: centerY };
}

const delayBetweenClicks = 5; // Set this value to control the delay between clicks
const delayBetweenKeystrokes = 10; // Set this value to control typing speed

async function mouseoverAtPosition(
  x: number,
  y: number
): Promise<void> {
  if (Debug) console.log('mouse over at', x, y);
  callRPC('ripple', [x, y]);
  await sendCommand('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
    button: 'none',
  });
}

async function hover(payload: { elementId: number }) {
  const objectId = await getObjectId(payload.elementId);
  await scrollIntoView(objectId);
  const { x, y } = await getCenterCoordinates(objectId);
  await mouseoverAtPosition(x, y);
  // await clickAtPosition(x, y);

  const dom = await callRPC('getDOM') as string;
  const url = await callRPC('getURl') as string;
  const metadata = {
    DOM: dom,
    AXTree: treecontent,
    Screenshot: '<image data>',
    action_type: 'click',
    position: `{ ${x}, ${y} }`,
    nodeID: payload.elementId,
    URL: url
  }

  return metadata;
}

async function clickAtPosition(
  x: number,
  y: number,
  clickCount = 1
): Promise<void> {
  if (Debug) console.log('clicking', x, y);
  callRPC('ripple', [x, y]);
  await sendCommand('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount,
  });
  await sendCommand('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount,
  });
  await sleep(delayBetweenClicks);
}

async function click(payload: { elementId: number }) {
  const objectId = await getObjectId(payload.elementId);
  await scrollIntoView(objectId);
  const { x, y } = await getCenterCoordinates(objectId);
  await clickAtPosition(x, y);
  const dom = await callRPC('getDOM') as string;
  const url = await callRPC('getURl') as string;
  const metadata = {
    DOM: dom,
    AXTree: treecontent,
    Screenshot: '<image data>',
    action_type: 'click',
    position: `{ ${x}, ${y} }`,
    nodeID: payload.elementId,
    URL: url
  }

  return metadata;
}

async function scroll(payload: { direction: string }) {
  await callRPC('scrollInDirection', [payload.direction]);
  const dom = await callRPC('getDOM') as string;
  const url = await callRPC('getURl') as string;
  const metadata = {
    DOM: dom,
    AXTree: treecontent,
    Screenshot: '<image data>',
    action_type: 'scroll',
    position: ``,
    nodeID: -1,
    URL: url
  }

  return metadata;
}

async function ripple(payload: { elementId: number }) {
  const objectId = await getObjectId(payload.elementId);
  await scrollIntoView(objectId);
  const { x, y } = await getCenterCoordinates(objectId);
  await callRPC('ripple', [x, y]);
}

async function getObjID(elementId: number): Promise<any>{
  
  const result = await sendCommand('DOM.resolveNode', {"backendNodeId": elementId}) as any;
  const objectId = result.object.objectId;
  return objectId;
}

async function getUniqueID(objectId: any): Promise<any>{

  const UNIQUE_domnode_id = (await sendCommand('Runtime.callFunctionOn', {
                        objectId, // objectId is the identifier for the DOM element
                        functionDeclaration: getAttrString,
                        returnByValue: true
                      })) as any;
  
  // console.log('UNIQUE_domnode_id', UNIQUE_domnode_id, UNIQUE_domnode_id.result.value);

  if (UNIQUE_domnode_id.result.type === "string") {
    return UNIQUE_domnode_id.result.value;        
  }
  return '-1';         
}

async function get_bounding_client_rect(objectId: any): Promise<any>{
  const model = (await sendCommand('Runtime.callFunctionOn', { 
                      objectId,
                      functionDeclaration: 
                      `function() {
                          if (this.nodeType == 3) {
                              var range = document.createRange();
                              range.selectNode(this);
                              var rect = range.getBoundingClientRect().toJSON();
                              range.detach();
                              return rect;
                          } else {
                              return this.getBoundingClientRect().toJSON();
                          }
                      }`,
                    returnByValue: true
                  })) as any;
  
  return model;
}

// https://github.com/web-arena-x/webarena/blob/main/browser_env/processors.py#L474
async function parse_accessibility_tree(axTree: Node[]): Promise<[string, Record<string, any>]> {
  const nodeIDToIdx: Record<string, number> = {};
  axTree.forEach((node, idx) => {
    nodeIDToIdx[node.nodeId] = idx;
  });

  const obsNodesInfo: Record<string, any> = {};

  const dfs = (idx: number, obsNodeId: string, depth: number): string => {
    let treeStr = "";
    const node = axTree[idx];
    const indent = "\t".repeat(depth);
    let validNode = true;
    let currentviewportnode = "";
    let role = "";
    let name = "";
    let backendnodeID = "";
    // parse the nodeID
    let uniqueID = "";
    let aria_tag_label = "";
    try {
      role = node.role.value;
      name = node.name.value;
      backendnodeID = node.backendDOMNodeId !== undefined ? node.backendDOMNodeId.toString() : "";
      if (node.name && node.name.sources) {
        const nameSources = node.name.sources;
        for (const source of nameSources) {
          if (source.attribute === 'aria-labelledby' && source.attributeValue && source.attributeValue.type === 'string') {
            aria_tag_label = source.attributeValue.value;
            break;
          }
        }
      }
    } catch (e) {
      validNode = false;
    }

    if (aria_tag_label !== "") uniqueID = aria_tag_label.split("_")[0];
    if (aria_tag_label !== "") currentviewportnode = aria_tag_label.split("_")[1];

    if (Debug) console.log(`[${backendnodeID}] ${role} ${JSON.stringify(name)} checking uid ${uniqueID}`);
    
    if (!flagforcurrentViewportOnly || currentviewportnode === "1")
    {
      let nodeStr = `[${uniqueID}] ${role} ${JSON.stringify(name)}`;
      const properties: string[] = [];
      node.properties?.forEach((property) => {
        if (!IGNORED_ACTREE_PROPERTIES.includes(property.name)) {
          properties.push(`${property.name}: ${property.value.value}`);
        }
      });

      if (properties.length > 0) {
        nodeStr += " " + properties.join(" ");
      }

      if (!nodeStr.trim() || !name.trim() && (!properties.length && ["generic", "img", "list", "strong", "paragraph", "banner", "navigation", "Section", "LabelText", "Legend", "listitem"].includes(role) || role === "listitem")) {
        validNode = false;
      }

      if (validNode) {
        treeStr += `${indent}${nodeStr}`;
        obsNodesInfo[obsNodeId] = {
          backend_id: node.backendDOMNodeId,
          union_bound: node.union_bound,
          text: nodeStr,
        };

        if (node.backendDOMNodeId !== undefined)
          flagDictionary.push(node.backendDOMNodeId);
      }
    }

    node.childIds.forEach((childNodeId) => {
      if (childNodeId in nodeIDToIdx) {
        const childDepth = validNode ? depth + 1 : depth;
        const childStr = dfs(nodeIDToIdx[childNodeId], childNodeId, childDepth);
        if (childStr.trim()) {
          if (treeStr.trim()) {
            treeStr += "\n";
          }
          treeStr += childStr;
        }
      }
    });

    return treeStr;
  };

  const treeStr = dfs(0, axTree[0].nodeId, 0);
  return [treeStr, obsNodesInfo];
}

// https://github.com/web-arena-x/webarena/blob/main/browser_env/processors.py#L561C9-L561C32
async function clean_accesibility_tree(treeStr: string): Promise<string> {
  const cleanLines: string[] = [];
  const lines = treeStr.split("\n");
  const pattern = /\[\d+\] StaticText (.+)/;

  for (const line of lines) {
    if (/statictext/i.test(line.toLowerCase())) {
      const prevLines = cleanLines.slice(-3);
      const match = line.match(pattern);

      if (match) {
        const staticText = match[1].slice(1, -1); // remove the quotes
        const isUnique = prevLines.every(prevLine => !prevLine.includes(staticText));

        if (staticText && isUnique) {
          cleanLines.push(line);
        }
      }
    } else {
      cleanLines.push(line);
    }
  }

  if (Debug)
  {
    console.log(cleanLines.join("\n"));
    const textData = cleanLines.join("\n");
    console.log(textData);
    const blob = new Blob([textData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    chrome.downloads.download({
      url: url,
      filename: 'axtree_text.txt', 
      saveAs: true
    });  
  } 

  return cleanLines.join("\n");
}

// https://github.com/web-arena-x/webarena/blob/main/browser_env/processors.py#L363
export async function fetch_page_accessibility_tree(currentViewportOnly: boolean): Promise<string> {
  const result = await sendCommand('Accessibility.getFullAXTree', {}) as any;
  axTree = result.nodes;

  if (Debug)
  {
    const axTreeJSON = JSON.stringify(axTree, null, 2);
    console.log(axTree);
    const blob = new Blob([axTreeJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: 'axtree.json',
      saveAs: true
    });
  }

  const sTime = performance.now();
  let seenIds = new Set();
  let _accessibilityTree : Node[] = [];

  for (let node of axTree) {
    if (!seenIds.has(node.nodeId)) {
      _accessibilityTree.push(node);
      seenIds.add(node.nodeId);
    }
  }

  // tree did not load properly
  if (_accessibilityTree.length < 10) return "";

  const fTime = performance.now();
  console.log(`Filter repetition ID took: ${fTime - sTime} milliseconds`);

  if (Debug) console.log('_accessibilityTree', _accessibilityTree);
  const [treeStr, obsNodesInfo] = await parse_accessibility_tree(_accessibilityTree);

  const pTime = performance.now();
  console.log(`parse DFS took: ${pTime - fTime} milliseconds`);
  
  treecontent = await clean_accesibility_tree(treeStr);
  if (Debug) console.log('treecontent', treecontent);

  const cTime = performance.now();
  console.log(`final cleanup took: ${cTime - pTime} milliseconds`);

  return treecontent;
}

// https://github.com/oaishi/annotation_pg/blob/main/Chrome_Debugger_Code_for_annotation/background.js#L51
export async function takeScreenshot(): Promise<string> {
  const result = await sendCommand('Page.captureScreenshot', {
    format: 'png'
  }) as any;
  return result.data;

  // const screenshotData = result.data;
  // const dataUrl = 'data:image/png;base64,' + screenshotData;
  // chrome.downloads.download({
  //   url: dataUrl,
  //   filename: filename,
  //   saveAs: true
  // });
}

async function selectAllText(x: number, y: number) {
  await clickAtPosition(x, y, 3);
}

async function typeText(text: string): Promise<void> {
  for (const char of text) {
    await sendCommand('Input.dispatchKeyEvent', {
      type: 'keyDown',
      text: char,
    });
    await sleep(delayBetweenKeystrokes / 2);
    await sendCommand('Input.dispatchKeyEvent', {
      type: 'keyUp',
      text: char,
    });
    await sleep(delayBetweenKeystrokes / 2);
  }
}

async function blurFocusedElement() {
  const blurFocusedElementScript = `
      if (document.activeElement) {
        document.activeElement.blur();
      }
    `;
  await sendCommand('Runtime.evaluate', {
    expression: blurFocusedElementScript,
  });
}

async function setvalue(payload: {
  elementId: number;
  value: string;
}): Promise<DomElementmetadata> {
  const objectId = await getObjectId(payload.elementId);
  await scrollIntoView(objectId);
  const { x, y } = await getCenterCoordinates(objectId);

  await selectAllText(x, y);
  await typeText(payload.value);
  // blur the element
  await blurFocusedElement();

  const dom = await callRPC('getDOM') as string;
  const url = await callRPC('getURl') as string;
  const metadata = {
    DOM: dom,
    AXTree: treecontent,
    Screenshot: '<image data>',
    action_type: 'setvalue',
    position: `{ ${x}, ${y} }`,
    nodeID: payload.elementId,
    URL: url
  }

  return metadata;
}

async function goto(payload: {
  url: string;
}): Promise<DomElementmetadata> {
  await sendCommand('Page.navigate', {url: payload.url}) as any;
  // const dom = await callRPC('getDOM') as string;
  const metadata = {
    DOM: '',
    AXTree: '',
    Screenshot: '<image data>',
    action_type: 'goto',
    position: ``,
    nodeID: -1,
    URL: payload.url
  }

  return metadata;
}

export async function hintTooltip(payload: { elementId: number, value?: string}, tooltipText: string) {
  const objectId = await getObjectId(payload.elementId);
  await scrollIntoView(objectId);
  const { x, y } = await getCenterCoordinates(objectId);
  await callRPC('showTooltipAtPosition', [x, y, 'next action: ' + tooltipText]);
}
 
export const domActions = {
  click,
  setvalue,
  ripple,
  goto,
  hover,
  scroll,
} as const;

export type DOMActions = typeof domActions;
type ActionName = keyof DOMActions;
type ActionPayload<T extends ActionName> = Parameters<DOMActions[T]>[0];

// Call this function from the content script
export const callDOMAction = async <T extends ActionName>(
  type: T,
  payload: ActionPayload<T>
): Promise<DomElementmetadata> => {
  // @ts-expect-error - we know that the type is valid
  return await domActions[type](payload);
};
