# Change Log

## [Unreleased]
- Find All References (`Shift+F12`): real reference search for types and enum
  members across field types, nested containers, typedefs, const values, service
  signatures, `throws` and `extends`
- Cross-file references via `include`, including reverse lookup over workspace
  `.thrift` files and include-alias disambiguation
- Honors the `Include declaration` setting and returns precise identifier ranges

## [0.0.1]
- Initial release

## [0.0.2]
- Update README.md

## [0.0.3]
- Update README.md
- add try...catch for fs.readFileSync

## [0.0.4]
- Can jump to the Enum's member position

## [0.0.6]
- Adds `thrift.root` setting to configure where relative paths are resolved from