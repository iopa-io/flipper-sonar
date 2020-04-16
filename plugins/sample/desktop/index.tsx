import React, { useState } from 'react'

import {
  FlipperBasePlugin,
  Button,
  Input,
  FlexColumn,
  styled,
  Text
} from 'flipper'

import { createFlipperPlugin, useFlipper } from 'flipper-hooks'

type DisplayMessageResponse = {
  greeting: string
}

type Message = {
  message: string | null | undefined
}

type PersistedState = {
  currentNotificationIds: Array<number>
  receivedMessage: string | null
}

const Container = styled(FlexColumn)({
  alignItems: 'center',
  justifyContent: 'space-around',
  padding: 20
})

const SamplePlugin: React.FC<{}> = _ => {
  const {
    client,
    persistedState,
    setActiveNotifications,
    setPersistedStateReducer
  } = useFlipper()

  /* Reducer to process incoming "send" messages from the mobile counterpart. */
  setPersistedStateReducer(
    (persistedState: PersistedState, method: string, payload: Message) => {
      if (method === 'triggerNotification') {
        return {
          ...persistedState,
          currentNotificationIds: persistedState.currentNotificationIds.concat([
            1
          ])
        } as PersistedState
      }
      if (method === 'log') {
        return { ...persistedState, receivedMessage: payload.message }
      }
      return persistedState
    }
  )

  /* Reducer to set Notifications based on persisted State */
  setActiveNotifications((persistedState: PersistedState) =>
    persistedState.currentNotificationIds.map((x: number) => ({
      id: `test-notification:${x}`,
      message: 'Example Notification',
      severity: 'warning' as 'warning',
      title: `Notification: ${x}`
    }))
  )

  const [prompt, setPrompt] = useState(
    'Type a message below to see it displayed on the mobile app'
  )

  const [message, setMessage] = useState('')

  const sendMessage = async () => {
    const _params: DisplayMessageResponse = await client.call(
      'displayMessage',
      { message: message || 'Weeeee!' }
    )

    setPrompt('Nice')
  }

  return (
    <Container>
      <Text>{prompt}</Text>
      <Input placeholder="Message" onChange={e => setMessage(e.target.value)} />
      <Button onClick={sendMessage}>Send</Button>
      {persistedState.receivedMessage && (
        <Text> {persistedState.receivedMessage} </Text>
      )}
    </Container>
  )
}

const Plugin = createFlipperPlugin(
  'flipper-plugin-sonar-sample',
  SamplePlugin,
  {
    defaultPersistedState: {
      currentNotificationIds: [],
      receivedMessage: null
    }
  }
)

export default Plugin
