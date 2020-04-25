import React, { useMemo, useState, useImperativeHandle, forwardRef } from 'react'
import { ManagedTable, Panel} from 'flipper'

export const ManagedTableSelect = forwardRef(({
  highlightedRows,
  onRowHighlighted,
  ...rest
}: any, ref) => {
  const highlightedRowsDefault = useMemo(() => new Set<string>(), [])
  const [selectedRow, setSelectedRow] = useState<string>(null)
  highlightedRows = highlightedRows || highlightedRowsDefault

  useImperativeHandle(ref, () => ({
    clear: () => {
      highlightedRows.clear()
      setSelectedRow(null)
    }
  }));

  const handleActivityRowHighlighted = keys => {
    const id = keys[0]
    if (!id) {
      return
    }
    if (selectedRow === keys[0]) {
      setSelectedRow(null)
      highlightedRows.clear()
      onRowHighlighted(null)
      return
    }
    setSelectedRow(id)
    onRowHighlighted(id)
  }

  return (
    <ManagedTable
      {...rest}
      multiHighlight={false}
      onRowHighlighted={handleActivityRowHighlighted}
      highlightedRows={highlightedRows}
    />
  )
})


export const ManagedTableGroup = ({
  groups,
  onRowHighlighted,
  rows,
  title,
  ...rest
}: any, ref) => {

  const refs: Record<string, React.MutableRefObject<any>> = {}

  // groups array must always be same length in order not to break rule of hooks
  // eslint-disable-next-line react-hooks/rules-of-hooks
  groups.forEach(group => refs[group] = React.useRef())

  const handleActivityRowHighlighted = (group, id) => {

    if (!id) {
      onRowHighlighted(group, null)
    }

    groups.forEach(g => { if (g !== group) { refs[g].current.clear() }})
    onRowHighlighted(group, id)
  }
  return (
  <>{groups.map(group => (
    <Panel key={group} padded={false} floating={false} heading={title(group)}>
    <ManagedTableSelect
        {...rest}
        onRowHighlighted={(id) => handleActivityRowHighlighted(group, id)}
        ref={refs[group]}
        rows={rows(group)}
      />
    </Panel>
    ))}
  </>)

}
