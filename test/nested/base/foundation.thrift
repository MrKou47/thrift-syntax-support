namespace cpp nested.base

enum Level {
  LOW = 0,
  HIGH = 1,
  CRITICAL = 2
}

struct Node {
  1: required string id,
  2: optional list<Node> children,
  3: optional Level level = Level.LOW
}

exception Fault {
  1: required i32 code,
  2: required string message
}
