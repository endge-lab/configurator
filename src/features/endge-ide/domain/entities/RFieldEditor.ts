import { Expose, Type } from 'class-transformer'
import { TypeMap } from '@endge/utils'
import { RField } from '@endge/core'
import { RuntimeFilterLinkEntity } from '@endge/core'

//
// Модель для редактирования RField компонента.
// После сохранения переводится в RField.
export class RFieldEditor {
  @Expose()
  name!: string

  @Expose()
  type!: string

  @Expose()
  isArray!: boolean

  @Expose()
  optional!: boolean

  /**
   * Важно: Map должен нормально сериализоваться/десериализоваться.
   * Используем TypeMap, как и в доменных сущностях.
   */
  @Expose()
  @Type(() => RFieldEditor)
  @TypeMap(RFieldEditor, 'name')
  params: Map<string, RFieldEditor> = new Map()

  @Expose({ name: 'runtime-filters' })
  runtimeFilters: RuntimeFilterLinkEntity[] = new RuntimeFilterLinkEntity()

  addParam(name: string, type: RFieldEditor): void {
    this.params.set(name, type)
  }

  getParams(): Map<string, RFieldEditor> {
    return this.params
  }

  updateSource(source: RField): void {
    source.name = this.name
    source.type = this.type
    source.isArray = this.isArray
    source.optional = this.optional
    source.runtimeFilters = this.runtimeFilters

    if (this.params && this.params.size > 0) {
      source.params = new Map()
      for (const [key, paramEditor] of this.params) {
        const param = new RField(paramEditor.name, paramEditor.type)
        paramEditor.updateSource(param)
        source.params.set(key, param)
      }
    } else {
      source.params = undefined
    }
  }

  fillFromSource(source: RField): void {
    this.name = source.name
    this.type = source.type
    this.isArray = source.isArray
    this.optional = source.optional
    this.runtimeFilters = source.runtimeFilters

    // гарантируем Map, даже если кто-то подсунул object
    this.params = new Map()

    if (source.params && source.params.size > 0) {
      for (const [key, param] of source.params) {
        const editor = new RFieldEditor()
        editor.fillFromSource(param)
        this.params.set(key, editor)
      }
    }
  }

  static createDefault(): RFieldEditor {
    const field = new RFieldEditor()
    field.name = ''
    field.type = 'Any'
    field.isArray = false
    field.optional = false
    field.params = new Map()
    return field
  }
}
