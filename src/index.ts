/**
 * Types
 */

type KeyValueMap = { [key: string]: any };

interface SuperFineElement extends Element {
  events: KeyValueMap;
  nodeValue: any; // todo
  [key: string]: any;
}

declare interface SuperFineNodeProps {
  oncreate?: (element: SuperFineElement, props?: SuperFineNodeProps) => void;
  onupdate?: (element: SuperFineElement, props?: SuperFineNodeProps) => void;
  onremove?: (element: SuperFineElement, func?: Function) => void;
  ondestroy?: (element: SuperFineElement, props?: SuperFineNodeProps) => void;
  children?: Array<SuperFineNode>;
  [key: string]: any;
}

interface SuperFineNode {
  key: any;
  element: SuperFineElement;
  type: number;
  children: Array<SuperFineNode>;
  props: SuperFineNodeProps;
  name: string;
}

declare interface SuperFineEvent {
  currentTarget: SuperFineElement;
  type: string;
}

type SuperFineLifecycle = Array<Function>;

/**
 * Superfine
 */

var DEFAULT = 0;
var RECYCLED_NODE = 1;
var TEXT_NODE = 2;

var merge = function(a: KeyValueMap, b: KeyValueMap) {
  var target: KeyValueMap = {};

  for (var i in a) target[i] = a[i];
  for (var i in b) target[i] = b[i];

  return target;
};

var eventProxy = function(event: SuperFineEvent) {
  return event.currentTarget.events[event.type](event);
};

var updateProperty = function(
  element: SuperFineElement,
  name: string,
  lastValue: any,
  nextValue: any
) {
  if (name === "key") {
  } else if (name === "style") {
    for (var i in merge(lastValue, nextValue)) {
      var style = nextValue == null || nextValue[i] == null ? "" : nextValue[i];
      if (i[0] === "-") {
        element[name].setProperty(i, style);
      } else {
        (element[name] as KeyValueMap)[i] = style;
      }
    }
  } else {
    if (name[0] === "o" && name[1] === "n") {
      if (!element.events) element.events = {};

      element.events[(name = name.slice(2))] = nextValue;

      if (nextValue == null) {
        // @ts-ignore
        element.removeEventListener(name, eventProxy);
      } else if (lastValue == null) {
        // @ts-ignore
        element.addEventListener(name, eventProxy);
      }
    } else {
      var nullOrFalse = nextValue == null || nextValue === false;

      if (
        name in element &&
        name !== "list" &&
        name !== "draggable" &&
        name !== "spellcheck" &&
        name !== "translate"
      ) {
        element[name] = nextValue == null ? "" : nextValue;
        if (nullOrFalse) {
          element.removeAttribute(name);
        }
      } else {
        if (nullOrFalse) {
          element.removeAttribute(name);
        } else {
          element.setAttribute(name, nextValue);
        }
      }
    }
  }
};

var createElement = function(
  node: SuperFineNode,
  lifecycle: SuperFineLifecycle
) {
  // @ts-ignore
  var element: SuperFineElement =
    node.type === TEXT_NODE
      ? document.createTextNode(node.name)
      : document.createElement(node.name);

  var props = node.props;
  if (props.oncreate) {
    lifecycle.push(function() {
      // @ts-ignore // the if above catches this
      props.oncreate(element as SuperFineElement);
    });
  }

  for (var i = 0, length = node.children.length; i < length; i++) {
    element.appendChild(createElement(node.children[i], lifecycle));
  }

  for (var name in props) {
    updateProperty(element, name, null, props[name]);
  }

  return (node.element = element);
};

var updateElement = function(
  element: SuperFineElement,
  lastProps: SuperFineNodeProps,
  nextProps: SuperFineNodeProps,
  lifecycle: SuperFineLifecycle,
  isRecycled: boolean
) {
  for (var name in merge(lastProps, nextProps)) {
    if (
      (name === "value" || name === "checked"
        ? element[name]
        : lastProps[name]) !== nextProps[name]
    ) {
      updateProperty(element, name, lastProps[name], nextProps[name]);
    }
  }

  var cb = isRecycled ? nextProps.oncreate : nextProps.onupdate;
  if (cb != null) {
    lifecycle.push(function() {
      // @ts-ignore // the if above catches this
      cb(element, lastProps);
    });
  }
};

var removeChildren = function(node: SuperFineNode) {
  for (var i = 0, length = node.children.length; i < length; i++) {
    removeChildren(node.children[i]);
  }

  var cb = node.props.ondestroy;
  if (cb != null) {
    cb(node.element);
  }

  return node.element;
};

var removeElement = function(parent: SuperFineElement, node: SuperFineNode) {
  var remove = function() {
    parent.removeChild(removeChildren(node));
  };

  var cb = node.props && node.props.onremove;
  if (cb != null) {
    cb(node.element, remove);
  } else {
    remove();
  }
};

var getKey = function(node: SuperFineNode) {
  return node == null ? null : node.key;
};

var createKeyMap = function(
  children: Array<SuperFineNode>,
  start: number,
  end: number
) {
  var out: KeyValueMap = {};
  var key;
  var node;

  for (; start <= end; start++) {
    if ((key = (node = children[start]).key) != null) {
      out[key] = node;
    }
  }

  return out;
};

var patchElement = function(
  parent: SuperFineElement,
  element: SuperFineElement,
  lastNode: SuperFineNode | null,
  nextNode: SuperFineNode,
  lifecycle: SuperFineLifecycle
) {
  if (nextNode === lastNode) {
  } else if (
    lastNode != null &&
    lastNode.type === TEXT_NODE &&
    nextNode.type === TEXT_NODE
  ) {
    if (lastNode.name !== nextNode.name) {
      element.nodeValue = nextNode.name;
    }
  } else if (lastNode == null || lastNode.name !== nextNode.name) {
    var newElement = parent.insertBefore(
      createElement(nextNode, lifecycle),
      element
    );

    if (lastNode != null) removeElement(parent, lastNode);

    element = newElement;
  } else {
    updateElement(
      element,
      lastNode.props,
      nextNode.props,
      lifecycle,
      lastNode.type === RECYCLED_NODE
    );

    var savedNode;
    var childNode;

    var lastKey;
    var lastChildren = lastNode.children;
    var lastChStart = 0;
    var lastChEnd = lastChildren.length - 1;

    var nextKey;
    var nextChildren = nextNode.children;
    var nextChStart = 0;
    var nextChEnd = nextChildren.length - 1;

    while (nextChStart <= nextChEnd && lastChStart <= lastChEnd) {
      lastKey = getKey(lastChildren[lastChStart]);
      nextKey = getKey(nextChildren[nextChStart]);

      if (lastKey == null || lastKey !== nextKey) break;

      patchElement(
        element,
        lastChildren[lastChStart].element,
        lastChildren[lastChStart],
        nextChildren[nextChStart],
        lifecycle
      );

      lastChStart++;
      nextChStart++;
    }

    while (nextChStart <= nextChEnd && lastChStart <= lastChEnd) {
      lastKey = getKey(lastChildren[lastChEnd]);
      nextKey = getKey(nextChildren[nextChEnd]);

      if (lastKey == null || lastKey !== nextKey) break;

      patchElement(
        element,
        lastChildren[lastChEnd].element,
        lastChildren[lastChEnd],
        nextChildren[nextChEnd],
        lifecycle
      );

      lastChEnd--;
      nextChEnd--;
    }

    if (lastChStart > lastChEnd) {
      while (nextChStart <= nextChEnd) {
        element.insertBefore(
          createElement(nextChildren[nextChStart++], lifecycle),
          (childNode = lastChildren[lastChStart]) && childNode.element
        );
      }
    } else if (nextChStart > nextChEnd) {
      while (lastChStart <= lastChEnd) {
        removeElement(element, lastChildren[lastChStart++]);
      }
    } else {
      var lastKeyed = createKeyMap(lastChildren, lastChStart, lastChEnd);
      var nextKeyed: KeyValueMap = {};

      while (nextChStart <= nextChEnd) {
        lastKey = getKey((childNode = lastChildren[lastChStart]));
        nextKey = getKey(nextChildren[nextChStart]);

        if (
          nextKeyed[lastKey] ||
          (nextKey != null && nextKey === getKey(lastChildren[lastChStart + 1]))
        ) {
          if (lastKey == null) {
            removeElement(element, childNode);
          }
          lastChStart++;
          continue;
        }

        if (nextKey == null || lastNode.type === RECYCLED_NODE) {
          if (lastKey == null) {
            patchElement(
              element,
              childNode && childNode.element,
              childNode,
              nextChildren[nextChStart],
              lifecycle
            );
            nextChStart++;
          }
          lastChStart++;
        } else {
          if (lastKey === nextKey) {
            patchElement(
              element,
              childNode.element,
              childNode,
              nextChildren[nextChStart],
              lifecycle
            );
            nextKeyed[nextKey] = true;
            lastChStart++;
          } else {
            if ((savedNode = lastKeyed[nextKey]) != null) {
              patchElement(
                element,
                element.insertBefore(
                  savedNode.element,
                  childNode && childNode.element
                ),
                savedNode,
                nextChildren[nextChStart],
                lifecycle
              );
              nextKeyed[nextKey] = true;
            } else {
              patchElement(
                element,
                childNode && childNode.element,
                null,
                nextChildren[nextChStart],
                lifecycle
              );
            }
          }
          nextChStart++;
        }
      }

      while (lastChStart <= lastChEnd) {
        if (getKey((childNode = lastChildren[lastChStart++])) == null) {
          removeElement(element, childNode);
        }
      }

      for (var key in lastKeyed) {
        if (nextKeyed[key] == null) {
          removeElement(element, lastKeyed[key]);
        }
      }
    }
  }

  return (nextNode.element = element);
};

var createVNode = function(
  name: string,
  props: SuperFineNodeProps,
  children: Array<any>,
  element: SuperFineElement,
  key: any,
  type: number
): SuperFineNode {
  return {
    name: name,
    props: props,
    children: children,
    element: element,
    key: key,
    type: type
  };
};

var createTextVNode = function(text: string, element: SuperFineElement) {
  return createVNode(text, {}, [], element, null, TEXT_NODE);
};

var recycleChild = function(element: SuperFineElement) {
  return element.nodeType === 3 // Node.TEXT_NODE
    ? createTextVNode(element.nodeValue, element)
    : recycleElement(element);
};

var recycleElement = function(element: SuperFineElement) {
  return createVNode(
    element.nodeName.toLowerCase(),
    {},
    [].map.call(element.childNodes, recycleChild),
    element,
    null,
    RECYCLED_NODE
  );
};

var recycle = function(container: SuperFineElement) {
  return recycleElement(container.children[0] as SuperFineElement);
};

var patch = function(
  lastNode: SuperFineNode,
  nextNode: SuperFineNode,
  container: SuperFineElement
) {
  var lifecycle: SuperFineLifecycle = [];

  patchElement(
    container,
    container.children[0] as SuperFineElement,
    lastNode,
    nextNode,
    lifecycle
  );

  // @ts-ignore
  while (lifecycle.length > 0) lifecycle.pop()();

  return nextNode;
};

var h = function(name: Function | string, props: SuperFineNodeProps) {
  var node;
  var rest = [];
  var children = [];
  var length = arguments.length;

  while (length-- > 2) rest.push(arguments[length]);

  if ((props = props == null ? {} : props).children != null) {
    if (rest.length <= 0) {
      rest.push(props.children);
    }
    delete props.children;
  }

  while (rest.length > 0) {
    if (Array.isArray((node = rest.pop()))) {
      for (length = node.length; length-- > 0; ) {
        rest.push(node[length]);
      }
    } else if (node === false || node === true || node == null) {
    } else {
      // @ts-ignore
      children.push(typeof node === "object" ? node : createTextVNode(node));
    }
  }

  return typeof name === "function"
    ? name(props, (props.children = children))
    : createVNode(
        name,
        props,
        children,
        // @ts-ignore
        null,
        props.key,
        DEFAULT
      );
};

/**
 * "Exporting" with Google Closure Compiler
 */
// @ts-ignore
self["h"] = h;
// @ts-ignore
self["patch"] = patch;
// @ts-ignore
self["recycle"] = recycle;
export default { h, patch, recycle };
