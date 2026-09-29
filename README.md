# thrift-syntax-support

A functional VS Code extension for supporting Thrift syntax.

## Features

### Basic syntax support

![](./images/basic-syntax-support.png)

### Show Definitions of a Symbol

![](./images/auto-jump.gif)

### Find All References of a Symbol

Press `Shift+F12` (or right-click → **Find All References**) on any thrift symbol:

- top-level types: `struct`, `union`, `exception`, `enum`, `typedef`, `const`, `service`
- enum members, including qualified usage like `Status.PAID`
- references in field types, container generics (`list<map<string, T>>`), typedefs,
  const values, service parameters, return types, `throws` and `extends`
- cross-file references through `include` (e.g. `types.Shared`), with reverse
  lookup across every `.thrift` file in the workspace
- include aliases, e.g. the `types` in `types.Shared`
- respects the editor's **Include declaration** toggle

### Code Completion Proposals

![](./images/auto-complete.gif)

### Hovers show information about the symbol/object that's below the mouse cursor

![](./images/cursor.gif)****