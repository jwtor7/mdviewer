import type { Root, Element, ElementContent, RootContent } from 'hast';

const HEADER_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

function wrapInSection(children: ElementContent[]): Element {
  return {
    type: 'element',
    tagName: 'section',
    properties: { className: ['pdf-section'] },
    children
  };
}

/**
 * Rehype plugin that wraps header elements and their following content
 * in <section class="pdf-section"> elements to enable CSS break-inside: avoid
 * for better PDF page breaking behavior.
 *
 * Each header (h1-h6) starts a new section that includes all content
 * until the next header of any level. This flat structure ensures
 * each header + immediate content can be kept together on a page.
 */
export function rehypeSectionWrap() {
  return (tree: Root) => {
    const newChildren: RootContent[] = [];
    let currentSection: ElementContent[] = [];
    let inSection = false;

    for (const node of tree.children) {
      // Skip non-element nodes at root level (doctype, comments, text)
      if (node.type !== 'element') {
        if (inSection) {
          // If we're in a section, include it
          currentSection.push(node as ElementContent);
        } else {
          newChildren.push(node);
        }
        continue;
      }

      const element = node as Element;

      if (HEADER_TAGS.includes(element.tagName)) {
        // Close any existing section before starting a new one
        if (currentSection.length > 0) {
          newChildren.push(wrapInSection(currentSection));
          currentSection = [];
        }

        currentSection.push(element);
        inSection = true;
      } else if (inSection) {
        currentSection.push(element);
      } else {
        newChildren.push(element);
      }
    }

    // Don't forget to wrap the last section
    if (currentSection.length > 0) {
      newChildren.push(wrapInSection(currentSection));
    }

    tree.children = newChildren;
  };
}
