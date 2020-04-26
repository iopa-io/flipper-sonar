
import {Glyph, styled, colors} from 'flipper';
import React from 'react';

type Props = {
  title: string;
  icon: string;
  onClick: () => void;
};

const TableIcon = styled.div({
  marginRight: 9,
  marginTop: -3,
  marginLeft: 4,
  position: 'relative', // for settings popover positioning
  '&:hover': {
    cursor: 'pointer'
  },
});

export default function (props: Props) {
  return (
    <TableIcon onClick={props.onClick} title={props.title}>
      <Glyph
        name={props.icon}
        size={16}
        color={colors.macOSTitleBarIconActive}
      />
    </TableIcon>
  );
}
