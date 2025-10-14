import { NAME_ELEMENT_SELECTOR } from '../../constants';

function isInteractive(
  element: HTMLElement,
  style: CSSStyleDeclaration
): boolean {
  return (
    element.tagName === 'A' ||
    element.tagName === 'INPUT' ||
    element.tagName === 'BUTTON' ||
    element.tagName === 'SELECT' ||
    element.tagName === 'TEXTAREA' ||
    element.hasAttribute('onclick') ||
    element.hasAttribute('onmousedown') ||
    element.hasAttribute('onmouseup') ||
    element.hasAttribute('onkeydown') ||
    element.hasAttribute('onkeyup') ||
    style.cursor === 'pointer'
  );
}

function isVisible(element: HTMLElement, style: CSSStyleDeclaration): boolean {
  return (
    style.opacity !== '' &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.getAttribute('aria-hidden') !== 'true'
  );
}

let currentElements: HTMLElement[] = [];

function traverseDOM(node: Node, pageElements: HTMLElement[]) {
  const clonedNode = node.cloneNode(false) as Node;

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as HTMLElement;
    const style = window.getComputedStyle(element);

    const clonedElement = clonedNode as HTMLElement;

    pageElements.push(element);
    clonedElement.setAttribute('data-id', (pageElements.length - 1).toString());
    clonedElement.setAttribute(
      'data-interactive',
      isInteractive(element, style).toString()
    );
    clonedElement.setAttribute(
      'data-visible',
      isVisible(element, style).toString()
    );
  }

  node.childNodes.forEach((child) => {
    const result = traverseDOM(child, pageElements);
    clonedNode.appendChild(result.clonedDOM);
  });

  return {
    pageElements,
    clonedDOM: clonedNode,
  };
}

/**
 * getAnnotatedDom returns the pageElements array and a cloned DOM
 * with data-pe-idx attributes added to each element in the copy.
 */
export default function getAnnotatedDOM() {
  currentElements = [];
  const result = traverseDOM(document.documentElement, currentElements);
  return (result.clonedDOM as HTMLElement).outerHTML;
}

export function getDOM() {
  return document.documentElement.outerHTML;
}

// idempotent function to get a unique id for an element
export function getUniqueElementSelectorId(id: number): string {
  const element = currentElements[id];
  // element may already have a unique id
  let uniqueId = element.getAttribute(NAME_ELEMENT_SELECTOR);
  if (uniqueId) return uniqueId;
  uniqueId = Math.random().toString(36).substring(2, 10);
  element.setAttribute(NAME_ELEMENT_SELECTOR, uniqueId);
  return uniqueId;
}

export function getURl() {
  return document.URL;
}

interface IframeOffset {
  x: number;
  y: number;
  right: number;
  bottom: number;
}

function getElementPositionInfo(element: HTMLElement, iframe_offset: IframeOffset): [DOMRect, number] {
  const rect = element.getBoundingClientRect();
  let x = (rect.left + rect.right) / 2;
  let y = (rect.top + rect.bottom) / 2;

  const is_in_viewport = (
    x >= iframe_offset.x &&
    y >= iframe_offset.y &&
    x <= iframe_offset.right &&
    y <= iframe_offset.bottom
  );

  return [rect, (is_in_viewport) ? 1 : 0];
}

// function to attach unique ids with all elements
export async function attachuniqueIDwithelements(): Promise<number> {
  const { innerWidth: windowWidth, innerHeight: windowHeight } = window;
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;

  const iframe_offset = { x: scrollX, y: scrollY, right: windowWidth, bottom: windowHeight } as IframeOffset;
  // console.log('iframe_offset', iframe_offset);

  const allElements: HTMLCollectionOf<Element> = document.body.getElementsByTagName("*");
  let count = 0;
  for (let i = 0; i < allElements.length; i++) {
    // remove non-HTML elements
    if (!(allElements[i] instanceof HTMLElement)) {
      continue;
    }

    count = count + 1;
    (allElements[i] as HTMLElement).setAttribute(NAME_ELEMENT_SELECTOR, count.toString());

    // https://github.com/ServiceNow/BrowserGym/blob/main/core/src/browsergym/core/javascript/frame_mark_elements.js#L71
    // write dynamic element values to the DOM
    if (allElements[i].getAttribute('value') !== null) {
      allElements[i].setAttribute('value', allElements[i].getAttribute('value'));
    }
    // Write dynamic checked properties to the DOM
    if (typeof allElements[i].getAttribute('checked') !== 'undefined') {
        if (allElements[i].getAttribute('checked')) {
          allElements[i].setAttribute("checked", "");
        } else {
          allElements[i].removeAttribute("checked");
        }
    }

    // const is_in_viewport = 1;
    const [rect, is_in_viewport] = getElementPositionInfo(allElements[i] as HTMLElement, iframe_offset);
    (allElements[i] as HTMLElement).setAttribute('aria-labelledby', count.toString()+'_'+is_in_viewport.toString());
    (allElements[i] as HTMLElement).setAttribute('bounding_box', `left: ${rect.left}, right: ${rect.right}, top: ${rect.top}, bottom: ${rect.bottom}`);
  }

  return count;
}
