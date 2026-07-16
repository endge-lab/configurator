# Computation source

`RComputation` хранит один canonical `source`, начинающийся с `defineComputation`.

```ts
defineComputation({
  outputs: {
    base: input('value'),
    doubled: typescript({
      inputs: { value: output('base') },
      compute({ value }) {
        return value * 2
      },
    }),
  },
  result: output('doubled'),
})
```

- `outputs` is a named dependency graph. Forward references are allowed.
- `input(path?)` reads the external input; `output(name)` reads another node.
- Normal values use the safe shared ValueExpression vocabulary.
- `typescript` runs synchronous guest code inside the installed sandbox Worker.
- Imports, network, filesystem, timers, async functions and hidden domain reads are forbidden.
- `result` is required and produces the single computation result.

Для локальной полной замены используйте `Endge.bind.computation(identity, override)`. Persisted provider fields отсутствуют.

## ComponentSFC port

`computation` port возвращает renderer-neutral resource. A graph containing only Endge expressions is ready immediately. A graph with a `typescript` node starts in `pending` because it runs in the Worker sandbox.

```ts
const ports = definePorts({
  state: computation<Input, Output>({
    default: 'groundhandling-process-state',
  }),
})

const state = ports.state({
  process: props.process,
})
```

```vue
<Text if="state.loading">Загрузка…</Text>
<Text else-if="state.error" color="danger">
  {{ state.error.message }}
</Text>
<GroundHandling.Cell else :point="state.value.target" />
```

The resource recomputes when its input changes and uses latest-wins semantics. Runtime host owns and disposes it; Vue and Canvas adapters only consume its state.

## Local override

```ts
const unbind = Endge.bind.computation(
  'groundhandling-process-state',
  {
    execution: 'sync',
    run(input, api) {
      return calculateGroundHandlingState(input, api)
    },
  },
)
```

Override полностью заменяет persisted graph. Если local implementation выбрасывает ошибку, runtime не делает silent fallback к persisted source.
