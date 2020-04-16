/* eslint-disable jsx-a11y/accessible-emoji */
import React, { memo } from 'react'

import {
  Text,
  styled,
  Button,
  FlexColumn,
  FlipperPlugin,
  DetailSidebar,
  SearchableTable,
  DataDescription,
  ManagedDataInspector,
  Panel
} from 'flipper'

let counter = 1

const SideBar = memo<any>(({ logType, payload }) => {
  return (
    <>
      <Text style={{ fontSize: 20, padding: 10, fontWeight: 'bold' }}>
        {`💾 ${logType}`.toUpperCase()}
      </Text>
      <Panel floating={false} heading="💼 Payload">
        {typeof payload !== 'object' ? (
          <DataDescription
            setValue={() => {
              /** noop */
            }}
            type={typeof payload}
            value={payload}
          />
        ) : (
          <ManagedDataInspector data={payload} expandRoot />
        )}
      </Panel>
    </>
  )
})

function convertToJson(value) {
  if (
    typeof value === 'string' &&
    (value.startsWith('{') || value.startsWith('['))
  ) {
    try {
      return JSON.parse(value)
    } catch (e) {
      /** noop */
    }
  }
  return value
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp)
  return `${date
    .getHours()
    .toString()
    .padStart(2, '0')}:${date
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${date
    .getSeconds()
    .toString()
    .padStart(2, '0')}.${date
    .getMilliseconds()
    .toString()
    .padStart(3, '0')}`
}

const COLUMN_SIZE = {
  message: 'flex',
  timeStamp: 140,
  logType: 10
}

export const COLUMNS = {
  timeStamp: {
    value: 'Time'
  },
  logType: {
    value: 'Log Type'
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

const ActionsConatiner = styled.div({
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  flex: 1
})

const CurrentStateContainer = styled.div({
  width: '100%',
  height: 200,
  paddingTop: 5,
  paddingBottom: 5,
  paddingLeft: 10,
  paddingRight: 10,
  overflow: 'scroll',
  backgroundColor: 'rgb(246, 247, 249)'
})

interface State {
  selectedIds: string[]
  selectedData: any
}

interface PersistedState {
  items: any[]
}

class SonarLogViewPlugin extends FlipperPlugin<State, any, PersistedState> {
  id = 'SonarLogViewPlugin'

  constructor(props) {
    super(props)
    this.state = {
      selectedIds: [],
      selectedData: null
    }
    this.handleClear = this.handleClear.bind(this)
    this.handleRowHighlighted = this.handleRowHighlighted.bind(this)
  }

  static persistedStateReducer(
    persistedState: PersistedState,
    method: string,
    data
  ) {
    switch (method) {
      case 'log': {
        let lastPersistedActions = persistedState.items
        if (!lastPersistedActions) {
          lastPersistedActions = []
        }
        return {
          ...persistedState,
          items: [...lastPersistedActions, { ...data, uniqueId: counter++ }]
        }
      }
      default:
        return persistedState
    }
  }

  handleClear() {
    const { setPersistedState } = this.props
    this.setState({ selectedIds: [] })
    setPersistedState({ items: [] })
  }

  handleRowHighlighted(keys) {
    const { persistedState = {} as PersistedState } = this.props
    const { selectedIds } = this.state

    const selectedId = keys.length !== 1 ? null : keys[0]
    if (selectedIds.includes(selectedId)) {
      this.setState({
        selectedIds: []
      })
      return
    }
    const selectedData =
      persistedState.items &&
      persistedState.items.find(v => v.uniqueId === selectedId)

    const { uniqueId, logType, ...payload } = selectedData

    this.setState({
      selectedIds: [selectedId],
      selectedData: {
        uniqueId,
        logType,
        payload: convertToJson(payload)
      }
    })
  }

  renderSidebar() {
    const { selectedIds, selectedData } = this.state
    const selectedId = selectedIds[0]
    if (!selectedData || !selectedId) {
      return null
    }
    return <SideBar {...selectedData} />
  }

  buildRow(row) {
    return {
      columns: {
        timeStamp: {
          value: <Text>⏱️ {formatTimestamp(row.timeStamp)} ⏱️</Text>,
          filterValue: row.timeStamp
        },
        logType: {
          value: <Text>🚀 {row.logType}</Text>,
          filterValue: row.logType
        },
        message: {
          value: <Text>⏳ {row.message || ''}</Text>,
          filterValue: row.message
        }
      },
      key: row.uniqueId,
      copyText: JSON.stringify(row, null, 2),
      filterValue: `${row.logType}`
    }
  }

  render() {
    const { persistedState = {} as PersistedState } = this.props
    const { items = [] } = persistedState
    const rows = items.map(this.buildRow)

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
            🏷️ Logs
          </Text>
          <ActionsConatiner>
            <SearchableTable
              key={this.id}
              rowLineHeight={28}
              floating={false}
              multiline
              columnSizes={COLUMN_SIZE}
              columns={COLUMNS}
              onRowHighlighted={this.handleRowHighlighted}
              multiHighlight
              rows={rows}
              stickyBottom
              actions={
                <>
                  <Button onClick={this.handleClear}>🗑️ Clear</Button>
                </>
              }
            />
          </ActionsConatiner>
        </MainContainer>
        <DetailSidebar>{this.renderSidebar()}</DetailSidebar>
      </FlexColumn>
    )
  }
}

export default SonarLogViewPlugin
