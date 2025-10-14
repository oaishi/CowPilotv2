import { NAME_ELEMENT_SELECTOR } from '../constants';

// TypeScript function
function scrollIntoViewFunction() {
  // @ts-expect-error this is run in the browser context
  this.scrollIntoView({
    block: 'center',
    inline: 'center',
    // behavior: 'smooth',
  });
}

function get_attr() {
  // @ts-expect-error this is run in the browser context
  tx_id = this.getAttribute(NAME_ELEMENT_SELECTOR);
  // @ts-expect-error this is run in the browser context
  if (tx_id) {
    // @ts-expect-error this is run in the browser context
    return tx_id;
  }
  else
    return '-1';
}
// Convert the TypeScript function to a string
export const scrollScriptString = scrollIntoViewFunction.toString();
export const getAttrString = get_attr.toString();
