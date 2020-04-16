/* eslint-disable react/prefer-stateless-function */
/* eslint-disable no-useless-escape */
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 * @flow
 */

import React, { Component } from 'react'

import {
  View,
  styled,
  FlexColumn,
  FlexRow,
  ContextMenu,
  clipboard,
  Button,
  Text,
  colors,
  Toolbar,
  Spacer,
  Select,
  Notification,
  Props,
  FlipperPlugin
} from 'flipper'

import unicodeSubstring from 'unicode-substring'

type HeaderRowProps = {
  title: string
  value: string
}
type openLogsCallbackType = () => void

interface CrashReporterBarProps {
  openLogsCallback?: openLogsCallbackType
  crashSelector: CrashSelectorProps
}

interface CrashSelectorProps {
  crashes?: { [key: string]: string }
  orderedIDs?: Array<string>
  selectedCrashID: string
  onCrashChange?: (string) => void
}

interface Crash {
  notificationID: string
  callstack?: string
  reason: string
  name: string
  date: Date
}

interface CrashLog {
  callstack: string
  reason: string
  name: string
  date?: Date
}

type PersistedState = {
  crashes: Array<Crash>
}

interface State {
  crash?: Crash
}

const Padder = styled.div<{
  paddingLeft?: number
  paddingRight?: number
  paddingBottom?: number
  paddingTop?: number
}>(({ paddingLeft, paddingRight, paddingBottom, paddingTop }) => ({
  paddingLeft: paddingLeft || 0,
  paddingRight: paddingRight || 0,
  paddingBottom: paddingBottom || 0,
  paddingTop: paddingTop || 0
}))

const Title = styled(Text)({
  fontWeight: 'bold',
  color: colors.greyTint3,
  height: 'auto',
  width: 200,
  textOverflow: 'ellipsis'
})

const Line = styled(View)({
  backgroundColor: colors.greyTint2,
  height: 1,
  width: 'auto',
  marginTop: 2,
  flexShrink: 0
})

const Container = styled(FlexColumn)({
  overflow: 'auto',
  flexShrink: 0
})

const Value = styled(Text)({
  fontWeight: 'bold',
  color: colors.greyTint3,
  height: 'auto',
  maxHeight: 200,
  flexGrow: 1,
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
  wordWrap: 'break-word',
  lineHeight: 2,
  marginLeft: 8,
  marginRight: 8,
  overflow: 'hidden'
})

const FlexGrowColumn = styled(FlexColumn)({
  flexGrow: 1
})

const PluginRootContainer = styled(FlexColumn)({
  height: '100%'
})

const ScrollableColumn = styled(FlexGrowColumn)({
  overflow: 'auto',
  height: 'auto'
})

const StyledFlexGrowColumn = styled(FlexColumn)({
  flexGrow: 1
})

const StyledFlexRowColumn = styled(FlexRow)({
  aligItems: 'center',
  justifyContent: 'center',
  height: '100%'
})

const StyledFlexColumn = styled(StyledFlexGrowColumn)({
  justifyContent: 'center',
  alignItems: 'center'
})

const MatchParentHeightComponent = styled(FlexRow)({
  height: '100%'
})

const ButtonGroupContainer = styled(FlexRow)({
  paddingLeft: 4,
  paddingTop: 2,
  paddingBottom: 2,
  height: '100%'
})

const StyledSelectContainer = styled(FlexRow)({
  paddingLeft: 8,
  paddingTop: 2,
  paddingBottom: 2,
  height: '100%'
})

const StyledSelect = styled(Select)({
  height: '100%',
  maxWidth: 200
})

const StackTraceContainer = styled(FlexColumn)({
  backgroundColor: colors.greyStackTraceTint,
  flexShrink: 0
})

const UNKNOWN_CRASH_REASON = 'Cannot figure out the cause'

function truncate(baseString: string, numOfChars: number): string {
  if (baseString.length <= numOfChars) {
    return baseString
  }
  const truncatedString = unicodeSubstring(baseString, 0, numOfChars - 1)
  return `${truncatedString}\u2026`
}

function parsePath(content: string): string {
  const regex = /Path: *[\w\-\/\.\t\ \_\%]*\n/
  const arr = regex.exec(content)
  if (!arr || arr.length <= 0) {
    return null
  }
  const pathString = arr[0]
  const pathRegex = /[\w\-\/\.\t\ \_\%]*\n/
  const tmp = pathRegex.exec(pathString)
  if (!tmp || tmp.length === 0) {
    return null
  }
  const path = tmp[0]
  return path.trim()
}

class CrashSelector extends Component<CrashSelectorProps> {
  render() {
    const { crashes, selectedCrashID, orderedIDs, onCrashChange } = this.props
    return (
      <StyledFlexRowColumn>
        <ButtonGroupContainer>
          <MatchParentHeightComponent>
            <Button
              disabled={Boolean(!orderedIDs || orderedIDs.length <= 1)}
              compact
              onClick={() => {
                if (onCrashChange && orderedIDs) {
                  const index = orderedIDs.indexOf(selectedCrashID)
                  const nextIndex =
                    index < 1 ? orderedIDs.length - 1 : index - 1
                  const nextID = orderedIDs[nextIndex]
                  onCrashChange(nextID)
                }
              }}
              icon="chevron-left"
              iconSize={12}
              title="Previous Crash"
            />
          </MatchParentHeightComponent>
          <MatchParentHeightComponent>
            <Button
              disabled={Boolean(!orderedIDs || orderedIDs.length <= 1)}
              compact
              onClick={() => {
                if (onCrashChange && orderedIDs) {
                  const index = orderedIDs.indexOf(selectedCrashID)
                  const nextIndex =
                    index >= orderedIDs.length - 1 ? 0 : index + 1
                  const nextID = orderedIDs[nextIndex]
                  onCrashChange(nextID)
                }
              }}
              icon="chevron-right"
              iconSize={12}
              title="Next Crash"
            />
          </MatchParentHeightComponent>
        </ButtonGroupContainer>
        <StyledSelectContainer>
          <StyledSelect
            grow
            selected={selectedCrashID || 'NoCrashID'}
            options={crashes || { NoCrashID: 'No Crash' }}
            onChangeWithKey={(key: string) => {
              if (onCrashChange) {
                onCrashChange(key)
              }
            }}
          />
        </StyledSelectContainer>
      </StyledFlexRowColumn>
    )
  }
}

class CrashReporterBar extends Component<CrashReporterBarProps> {
  render() {
    const { openLogsCallback, crashSelector } = this.props
    return (
      <Toolbar>
        <CrashSelector {...crashSelector} />
        <Spacer />
        <Button
          disabled={Boolean(!openLogsCallback)}
          onClick={openLogsCallback}
        >
          Open In Logs
        </Button>
      </Toolbar>
    )
  }
}

class HeaderRow extends Component<HeaderRowProps> {
  render() {
    const { title, value } = this.props
    return (
      <Padder paddingTop={8} paddingBottom={2} paddingLeft={8}>
        <Container>
          <FlexRow>
            <Title>{title}</Title>
            <ContextMenu
              items={[
                {
                  label: 'copy',
                  click: () => {
                    clipboard.writeText(value)
                  }
                }
              ]}
            >
              <Value code>{value}</Value>
            </ContextMenu>
          </FlexRow>
          <Line />
        </Container>
      </Padder>
    )
  }
}

type StackTraceComponentProps = {
  stacktrace: string
}

class StackTraceComponent extends Component<StackTraceComponentProps> {
  render() {
    const { stacktrace } = this.props
    return (
      <StackTraceContainer>
        <Padder paddingTop={8} paddingBottom={2} paddingLeft={8}>
          <Value code>{stacktrace}</Value>
        </Padder>
        <Line />
      </StackTraceContainer>
    )
  }
}

export default class CrashReporterPlugin extends FlipperPlugin<
  State,
  any,
  PersistedState
> {
  static defaultPersistedState = { crashes: [] }

  static notificationID = 0

  /*
   * Reducer to process incoming "send" messages from the mobile counterpart.
   */
  static persistedStateReducer = (
    persistedState: PersistedState,
    method: string,
    payload: Record<string, any>
  ): PersistedState => {
    if (method === 'crash-report' || method === 'flipper-crash-report') {
      CrashReporterPlugin.notificationID++
      const mergedState: PersistedState = {
        crashes: persistedState.crashes.concat([
          {
            notificationID: CrashReporterPlugin.notificationID.toString(), // All notifications are unique
            callstack: payload.callstack,
            name: payload.name,
            reason: payload.reason,
            date: payload.date || new Date()
          }
        ])
      }
      return mergedState
    }
    return persistedState
  }

  static trimCallStackIfPossible = (callstack: string): string => {
    const regex = /Application Specific Information:/
    const query = regex.exec(callstack)
    return query ? callstack.substring(0, query.index) : callstack
  }

  /*
   * Callback to provide the currently active notifications.
   */
  static getActiveNotifications = (
    persistedState: PersistedState
  ): Array<Notification> => {
    const filteredCrashes = persistedState.crashes.filter(crash => {
      const ignore = !crash.name && !crash.reason
      const unknownCrashCause = crash.reason === UNKNOWN_CRASH_REASON
      if (ignore || unknownCrashCause) {
        console.error('Ignored the notification for the crash', crash)
      }
      return !ignore && !unknownCrashCause
    })
    return filteredCrashes.map((crash: Crash) => {
      const id = crash.notificationID
      const name: string = crash.name || crash.reason
      let title = `CRASH: ${truncate(name, 50)}`
      title = `${
        name === crash.reason
          ? title
          : `${title}Reason: ${truncate(crash.reason, 50)}`
      }`
      const callstack = crash.callstack
        ? CrashReporterPlugin.trimCallStackIfPossible(crash.callstack)
        : 'No callstack available'
      const msg = `Callstack: ${truncate(callstack, 200)}`
      return {
        id,
        message: msg,
        severity: 'error',
        title,
        action: id,
        category: crash.reason || 'Unknown reason'
      }
    })
  }

  openInLogs = (callstack: string) => {
    this.props.selectPlugin('DeviceLogs', callstack)
  }

  constructor(props: Props<PersistedState>) {
    // Required step: always call the parent class' constructor
    super(props)
    let crash: Crash = null
    if (
      this.props.persistedState.crashes &&
      this.props.persistedState.crashes.length > 0
    ) {
      crash = this.props.persistedState.crashes[
        this.props.persistedState.crashes.length - 1
      ]
    }

    let deeplinkedCrash = null
    if (this.props.deepLinkPayload) {
      const id = this.props.deepLinkPayload
      const index = this.props.persistedState.crashes.findIndex(elem => {
        return elem.notificationID === id
      })
      if (index >= 0) {
        deeplinkedCrash = this.props.persistedState.crashes[index]
      }
    }
    // Set the state directly. Use props if necessary.
    this.state = {
      crash: deeplinkedCrash || crash
    }
  }

  render() {
    let crashToBeInspected = this.state.crash

    if (!crashToBeInspected && this.props.persistedState.crashes.length > 0) {
      crashToBeInspected = this.props.persistedState.crashes[
        this.props.persistedState.crashes.length - 1
      ]
    }
    const crash = crashToBeInspected
    if (crash) {
      const { crashes } = this.props.persistedState
      const crashMap = crashes.reduce(
        (acc: { [key: string]: string }, persistedCrash: Crash) => {
          const { notificationID, date } = persistedCrash
          const name = `Crash at ${date.toLocaleString()}`
          acc[notificationID] = name
          return acc
        },
        {}
      )

      const orderedIDs = crashes.map(
        persistedCrash => persistedCrash.notificationID
      )
      const selectedCrashID = crash.notificationID
      const onCrashChange = id => {
        const newSelectedCrash = crashes.find(
          element => element.notificationID === id
        )
        this.setState({ crash: newSelectedCrash })
      }

      const callstackString = crash.callstack || ''
      const children = callstackString.split('\n').map(str => {
        return { message: str }
      })
      const crashSelector: CrashSelectorProps = {
        crashes: crashMap,
        orderedIDs,
        selectedCrashID,
        onCrashChange
      }
      const showReason = crash.reason !== UNKNOWN_CRASH_REASON
      return (
        <PluginRootContainer>
          <CrashReporterBar crashSelector={crashSelector} />
          <ScrollableColumn>
            <HeaderRow title="Name" value={crash.name} />
            {showReason ? (
              <HeaderRow title="Reason" value={crash.reason} />
            ) : null}
            <Padder paddingLeft={8} paddingTop={4} paddingBottom={2}>
              <Title> Stacktrace </Title>
            </Padder>
            <ContextMenu
              items={[
                {
                  label: 'copy',
                  click: () => {
                    clipboard.writeText(callstackString)
                  }
                }
              ]}
            >
              <Line />
              {children.map(child => {
                return (
                  <StackTraceComponent
                    key={child.message}
                    stacktrace={child.message}
                  />
                )
              })}
            </ContextMenu>
          </ScrollableColumn>
        </PluginRootContainer>
      )
    }
    const crashSelector = {
      crashes: null,
      orderedIDs: null,
      selectedCrashID: null,
      onCrashChange: null
    }
    return (
      <StyledFlexGrowColumn>
        <CrashReporterBar crashSelector={crashSelector} />
        <StyledFlexColumn>
          <Padder paddingBottom={8}>
            <Title>No Crashes Logged</Title>
          </Padder>
        </StyledFlexColumn>
      </StyledFlexGrowColumn>
    )
  }
}
