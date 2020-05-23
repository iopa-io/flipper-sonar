import React from 'react';

import {
  FlipperDevicePlugin,
  Device,
  styled,
  Text,
  FlexColumn,
  FlexRow,
  Markdown
} from 'flipper';

import { name as packageName } from '../package.json'

const Container = styled(FlexColumn)({
  padding: 20,
  width: 600,
});

const Title = styled(Text)({
  marginBottom: 18,
  marginRight: 10,
  fontWeight: 100,
  fontSize: '40px',
});

export default class SonarDesktopDiscovery extends FlipperDevicePlugin<
  {},
  any,
  any
> {
  static id = packageName

  static supportsDevice(device: Device) {
    return device.os === 'MacOS' || device.os === 'Windows';
  }

  render() {
    return (
      
      <Container>
        <Title>Sync SONAR for Desktop</Title>
        <FlexRow>
          <Markdown source={markdown} />
        </FlexRow>
      </Container>

    );
  }
}

const markdown=`
# Getting Started

Run the Sync SIM simulator on the desktop.   You'll see the device automatically appear in the side bar on the left.
`