<script setup lang="ts">
import type { RComponentSFC_IR } from '@endge/core'
import SFC_Renderer from '@/ui/render/sfc/SFC_Renderer.vue'

const ir: RComponentSFC_IR = {
  version: 1,
  script: {
    props: [],
    locals: [],
    ports: { computations: [], components: [] },
    portCalls: [],
  },
  template: {
    roots: [
      {
        id: 'root',
        kind: 'element',
        tag: 'Flex',
        props: {
          col: { kind: 'literal', value: true },
          gap: { kind: 'literal', value: '2' },
          p: { kind: 'literal', value: '4' },
        },
        directives: {},
        children: [
          {
            id: 'status-row',
            kind: 'element',
            tag: 'Flex',
            props: {
              row: { kind: 'literal', value: true },
              gap: { kind: 'literal', value: '2' },
              align: { kind: 'literal', value: 'center' },
            },
            directives: {},
            children: [
              {
                id: 'dot',
                kind: 'element',
                tag: 'Dot',
                props: {
                  tone: { kind: 'expression', source: 'flight.statusTone', reads: [] },
                },
                directives: {},
                children: [],
              },
              {
                id: 'badge',
                kind: 'element',
                tag: 'Badge',
                props: {
                  tone: { kind: 'expression', source: 'flight.statusTone', reads: [] },
                },
                directives: {},
                children: [
                  {
                    id: 'status',
                    kind: 'expression',
                    value: { kind: 'expression', source: 'flight.status', reads: [] },
                  },
                ],
              },
            ],
          },
          {
            id: 'route',
            kind: 'element',
            tag: 'Text',
            props: {},
            directives: {
              if: { kind: 'expression', source: '!compact', reads: [] },
            },
            children: [
              {
                id: 'route-value',
                kind: 'expression',
                value: { kind: 'expression', source: 'flight.route', reads: [] },
              },
            ],
          },
          {
            id: 'passengers',
            kind: 'element',
            tag: 'Text',
            props: {},
            directives: {
              for: {
                item: 'passenger',
                index: 'index',
                source: { kind: 'expression', source: 'passengers', reads: [] },
              },
            },
            children: [
              {
                id: 'passenger-name',
                kind: 'expression',
                value: { kind: 'expression', source: 'passenger.name', reads: [] },
              },
            ],
          },
          {
            id: 'nested',
            kind: 'element',
            tag: 'Component',
            props: {
              is: { kind: 'literal', value: 'flight-actions' },
              flight: { kind: 'expression', source: 'flight', reads: [] },
            },
            directives: {},
            children: [],
          },
        ],
      },
    ],
  },
  style: null,
}

const props = {
  flight: {
    status: 'Boarding',
    statusTone: 'success',
    route: 'SVO -> LED',
  },
  compact: false,
  passengers: [
    { name: 'Passenger A' },
    { name: 'Passenger B' },
  ],
}
</script>

<template>
  <SFC_Renderer
    :ir="ir"
    :props="props"
  />
</template>
