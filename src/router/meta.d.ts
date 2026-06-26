import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    layout?: 'default' | 'empty' | 'grid' | 'main'
  }
}
