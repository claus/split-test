export function toSelector(node: Element, attributeIgnoreList: string[] = []) {
    attributeIgnoreList = [...new Set([...attributeIgnoreList, 'id', 'class'])];
    let selector = node.nodeName.toLowerCase();
    const id = node.getAttribute('id');
    if (id != null) {
        selector += '#' + id;
    }
    selector += Array.from(node.classList)
        .map(className => `.${className}`)
        .join('');
    selector += Array.from(node.attributes)
        .filter(({ name }) => !attributeIgnoreList.includes(name))
        .map(({ name, value }) => (value ? `[${name}="${value}"]` : `[${name}]`))
        .join('');
    return selector;
}

/**
 * Returns an array of Nodes that make up the path from `root` to `child,
 * excluding `root` and including `child`.
 *
 * @param root - The node where the path starts
 * @param child - The node where the path ends. Must be a child of `root`
 * @returns An array of Nodes
 *
 * @example
 * For the following markup:
 * ```html
 * <div>
 *    <span>
 *       <b>
 *         <i>hello</i>
 *      </b>
 *    </span>
 * </div>
 * ```
 * createPath(span, i) will return `[b, i]`
 */
export function createPath(root: HTMLElement, child: HTMLElement): HTMLElement[] {
    const path: HTMLElement[] = [child];
    let el = child;
    while (el.parentElement && el.parentElement !== root) {
        el = el.parentElement;
        path.unshift(el);
    }
    return path;
}

/**
 * Moves all child nodes from node `from` to node `to`.
 *
 * @param from - The source node
 * @param to - The destination node
 */
export function moveChildNodes(from: Node, to: Node) {
    while (from.hasChildNodes()) {
        to.appendChild(from.removeChild(from.firstChild!));
    }
}

export function deepCloneUntil(node: Node, lastNode: Node, initialNode?: Node) {
    initialNode ??= node;
    console.log('deepClone', node, node === lastNode, initialNode.contains(lastNode));
    if (!initialNode.contains(lastNode)) {
        return null;
    }
    if (node !== lastNode && node.contains(lastNode)) {
        console.log('not clean node');
        const clonedNode = node.cloneNode(false);
        while (node.hasChildNodes()) {
            const firstChild = node.firstChild!;
            const deepClonedChild = deepCloneUntil(firstChild, lastNode, initialNode);
            if (deepClonedChild) {
                clonedNode.appendChild(deepClonedChild);
                if (firstChild === lastNode) {
                    console.log('lastNode found');
                    break;
                }
            } else {
                break;
            }
        }
        return clonedNode;
    } else {
        console.log('clean node');
        return node;
    }
}
