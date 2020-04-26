
import {Glyph, styled, colors} from 'flipper';
import React from 'react';

type Props = {
  title: string;
  icon: string;
  active: boolean;
  onClick: () => void;
};

const ToolbarIcon = styled.div({
  marginRight: 9,
  marginTop: -3,
  marginLeft: 4,
  position: 'relative', // for settings popover positioning
  '&:hover': {
    cursor: 'pointer'
  },
});

export default function (props: Props) {
  console.log(props.onClick)
  return (
    <ToolbarIcon onClick={props.onClick} title={props.title}>
      <Glyph
        name={props.icon}
        size={16}
        color={
          props.active
            ? colors.macOSTitleBarIconSelected
            : colors.macOSTitleBarIconActive
        }
      />
    </ToolbarIcon>
  );
}
