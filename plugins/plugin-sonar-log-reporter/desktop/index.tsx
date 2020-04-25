import React, { memo, useState } from 'react'

import {
  colors,
  Text,
  styled,
  Button,
  FlexColumn,
  DetailSidebar,
  SearchableTable,
  ManagedDataInspector,
  Panel,
  Glyph
} from 'flipper'

import { useFlipper, createFlipperPlugin } from 'flipper-hooks'

import { LogRecord } from './model'
import { formatTimestamp, reParseDates } from './util'
import { name as packageName, title, icon } from '../package.json'

interface PersistedState {
  items: any[]
}
const Icon = styled(Glyph)({
  marginTop: 5
})

const SideBar = memo<any>(({ logType, ...payload }: LogRecord) => {
  const { icon, style } = LOG_TYPES[logType] || LOG_TYPES.debug

  return (
    <>
      <Text style={{ fontSize: 20, padding: 5, fontWeight: 'bold' }}>
        {icon} {logType.toUpperCase()}
      </Text>
      <Panel floating={false} heading="Payload">
        <ManagedDataInspector data={payload} expandRoot />
      </Panel>
    </>
  )
})

const LOG_TYPES: {
  [level: string]: {
    label: string
    color: string
    icon?: React.ReactNode
    style?: Record<string, any>
  }
} = {
  verbose: {
    label: 'Verbose',
    color: colors.purple
  },
  debug: {
    label: 'Debug',
    color: colors.grey
  },
  info: {
    label: 'Info',
    icon: <Icon name="info-circle" color={colors.cyan} />,
    color: colors.cyan
  },
  warn: {
    label: 'Warn',
    style: {
      backgroundColor: colors.yellowTint,
      color: colors.yellow,
      fontWeight: 500
    },
    icon: <Icon name="caution-triangle" color={colors.yellow} />,
    color: colors.yellow
  },
  error: {
    label: 'Error',
    style: {
      backgroundColor: colors.redTint,
      color: colors.red,
      fontWeight: 500
    },
    icon: <Icon name="caution-octagon" color={colors.red} />,
    color: colors.red
  },
  fatal: {
    label: 'Fatal',
    style: {
      backgroundColor: colors.redTint,
      color: colors.red,
      fontWeight: 700
    },
    icon: <Icon name="stop" color={colors.red} />,
    color: colors.red
  }
}

const DEFAULT_FILTERS = [
  {
    type: 'enum',
    enum: Object.keys(LOG_TYPES).map(value => ({
      label: LOG_TYPES[value].label,
      value
    })),
    key: 'type',
    value: [],
    persistent: true
  }
]

const COLUMN_SIZE = {
  type: 40,
  timeStamp: 140,
  message: 'flex'
}

export const COLUMNS = {
  type: {
    value: ''
  },
  timeStamp: {
    value: 'Time'
  },
  message: {
    value: 'Message'
  }
}

const MainContainer = styled.div({
  display: 'flex',
  flexDirection: 'column',
  height: '100%'
})

const PluginView: React.FC<{}> = () => {
  const [selectedId, setSelectedId] = useState(null)
  const [selectedData, setSelectedData] = useState(null)

  const {
    client,
    persistedState,
    setPersistedStateReducer,
    setPersistedState
  } = useFlipper()

  React.useEffect(() => {
    ;(async () => {
      const raw = await client.call('getCache')
      const items: LogRecord[] = reParseDates(raw)
      if (items) {
        setPersistedState({ items })
      }
    })()
  }, [])

  setPersistedStateReducer(
    (persistedState: PersistedState, method: string, data: LogRecord) => {
      const logRow: LogRecord = reParseDates(data)
      switch (method) {
        case 'log': {
          const prevItems: LogRecord[] = persistedState.items || []

          return {
            ...persistedState,
            items: [
              ...prevItems.slice(Math.max(prevItems.length - 100, 0)),
              logRow
            ]
          }
        }
        default:
          return persistedState
      }
    }
  )
  const handleClear = () => {
    setSelectedId(null)
    setPersistedState({ ...persistedState, items: [] })
  }

  const handleRowHighlighted = keys => {
    const id = keys.length !== 1 ? null : keys[0]

    if (selectedId === id) {
      setSelectedId(null)
      return
    }
    const selectedData =
      persistedState.items && persistedState.items.find(row => row.id === id)

    const item = selectedData
    setSelectedId(id)
    setSelectedData(item)
  }

  const renderSidebar = () => {
    if (!selectedId || !selectedData) {
      return null
    }
    return <SideBar {...selectedData} />
  }

  const rows = persistedState.items.map((row: LogRecord) => {
    const { icon, style } = LOG_TYPES[row.logType] || LOG_TYPES.debug

    return {
      columns: {
        timeStamp: {
          value: <Text>{formatTimestamp(row.timeStamp)}</Text>,
          filterValue: row.timeStamp
        },
        type: {
          value: icon,
          align: 'center',
          filterValue: row.logType
        },
        message: {
          value: <Text>{row.message || ''}</Text>,
          filterValue: row.message
        }
      },
      key: row.id,
      type: row.logType,
      style,
      copyText: JSON.stringify(row, null, 2),
      filterValue: row.message
    }
  })

  return (
    <FlexColumn grow>
      <MainContainer>
        <Text
          style={{
            fontSize: 17,
            padding: 5,
            paddingLeft: 10,
            paddingRight: 10,
            fontWeight: 'bold'
          }}
        >
          <Glyph name={icon} /> {title}
        </Text>
        <SearchableTable
          key={packageName}
          rowLineHeight={28}
          floating={false}
          multiline
          defaultFilters={DEFAULT_FILTERS}
          columnSizes={COLUMN_SIZE}
          columns={COLUMNS}
          onRowHighlighted={handleRowHighlighted}
          multiHighlight={false}
          rows={rows}
          zebra={false}
          stickyBottom
          actions={
            <>
              <Button onClick={handleClear}>
                <Glyph title="Clear" name="trash" />
                Clear
              </Button>
            </>
          }
        />
      </MainContainer>
      <DetailSidebar>{renderSidebar()}</DetailSidebar>
    </FlexColumn>
  )
}

export default createFlipperPlugin(packageName, PluginView, {
  defaultPersistedState: {
    items: []
  }
})
