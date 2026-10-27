// Общая схема GraphQL для spec-файлов проверки и автодополнения gql-документов.
export const TEST_GRAPHQL_SDL = `
"Корень чтения"
type Query {
  "Пользователь по id"
  user(id: ID!, role: Role): User
  search(filter: UserFilter, first: Int = 10): [SearchResult!]!
  node(id: ID!): Node
}

type Subscription {
  userChanged(id: ID!): User
}

interface Node {
  id: ID!
}

type User implements Node {
  id: ID!
  name: String @deprecated(reason: "use fullName")
  fullName: String!
  role: Role
  friends(first: Int): [User!]!
}

type Bot implements Node {
  id: ID!
  model: String
}

union SearchResult = User | Bot

enum Role {
  ADMIN
  EDITOR
}

input UserFilter {
  role: Role
  name: String
  nested: UserFilter
}
`
