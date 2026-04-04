import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../store'

beforeEach(() => {
  useAppStore.setState({
    singleMarks: new Map(),
    virtualSets: [],
  })
})

describe('marks-slice - singleMark', () => {
  it('toggleSingleMarkでマークを追加する', () => {
    useAppStore.getState().toggleSingleMark('layer-1')
    const { singleMarks } = useAppStore.getState()
    expect(singleMarks.has('layer-1')).toBe(true)
    expect(singleMarks.get('layer-1')?.origin).toBe('manual')
  })

  it('toggleSingleMarkで2回押すとマークを解除する', () => {
    useAppStore.getState().toggleSingleMark('layer-1')
    useAppStore.getState().toggleSingleMark('layer-1')
    expect(useAppStore.getState().singleMarks.has('layer-1')).toBe(false)
  })

  it('複数のレイヤーに独立してマークできる', () => {
    useAppStore.getState().toggleSingleMark('layer-1')
    useAppStore.getState().toggleSingleMark('layer-2')
    const { singleMarks } = useAppStore.getState()
    expect(singleMarks.size).toBe(2)
  })
})

describe('marks-slice - virtualSet', () => {
  it('addVirtualSetで仮想セットを追加する', () => {
    useAppStore.getState().addVirtualSet('背景セット')
    const { virtualSets } = useAppStore.getState()
    expect(virtualSets).toHaveLength(1)
    expect(virtualSets[0].name).toBe('背景セット')
    expect(virtualSets[0].insertionLayerId).toBeNull()
    expect(virtualSets[0].members).toEqual([])
  })

  it('addVirtualSetでIDが自動生成される', () => {
    useAppStore.getState().addVirtualSet('A')
    useAppStore.getState().addVirtualSet('B')
    const { virtualSets } = useAppStore.getState()
    expect(virtualSets[0].id).not.toBe(virtualSets[1].id)
  })

  it('updateVirtualSetで名前を変更する', () => {
    useAppStore.getState().addVirtualSet('旧名前')
    const id = useAppStore.getState().virtualSets[0].id
    useAppStore.getState().updateVirtualSet(id, { name: '新名前' })
    expect(useAppStore.getState().virtualSets[0].name).toBe('新名前')
  })

  it('removeVirtualSetで削除する', () => {
    useAppStore.getState().addVirtualSet('セット')
    const id = useAppStore.getState().virtualSets[0].id
    useAppStore.getState().removeVirtualSet(id)
    expect(useAppStore.getState().virtualSets).toHaveLength(0)
  })

  it('addVirtualSetMemberでメンバーを追加する', () => {
    useAppStore.getState().addVirtualSet('セット')
    const id = useAppStore.getState().virtualSets[0].id
    useAppStore.getState().addVirtualSetMember(id, 'layer-1')
    const members = useAppStore.getState().virtualSets[0].members
    expect(members).toHaveLength(1)
    expect(members[0].layerId).toBe('layer-1')
    expect(members[0].blendMode).toBeNull()
  })

  it('同じメンバーを重複追加しない', () => {
    useAppStore.getState().addVirtualSet('セット')
    const id = useAppStore.getState().virtualSets[0].id
    useAppStore.getState().addVirtualSetMember(id, 'layer-1')
    useAppStore.getState().addVirtualSetMember(id, 'layer-1')
    expect(useAppStore.getState().virtualSets[0].members).toHaveLength(1)
  })

  it('removeVirtualSetMemberでメンバーを削除する', () => {
    useAppStore.getState().addVirtualSet('セット')
    const id = useAppStore.getState().virtualSets[0].id
    useAppStore.getState().addVirtualSetMember(id, 'layer-1')
    useAppStore.getState().removeVirtualSetMember(id, 'layer-1')
    expect(useAppStore.getState().virtualSets[0].members).toHaveLength(0)
  })

  it('reorderVirtualSetMembersでメンバーを並び替える', () => {
    useAppStore.getState().addVirtualSet('セット')
    const id = useAppStore.getState().virtualSets[0].id
    useAppStore.getState().addVirtualSetMember(id, 'layer-1')
    useAppStore.getState().addVirtualSetMember(id, 'layer-2')
    useAppStore.getState().addVirtualSetMember(id, 'layer-3')
    useAppStore.getState().reorderVirtualSetMembers(id, ['layer-3', 'layer-1', 'layer-2'])
    const members = useAppStore.getState().virtualSets[0].members
    expect(members[0].layerId).toBe('layer-3')
    expect(members[1].layerId).toBe('layer-1')
    expect(members[2].layerId).toBe('layer-2')
  })

  it('setVirtualSetMemberBlendModeでblendModeを更新する', () => {
    useAppStore.getState().addVirtualSet('セット')
    const id = useAppStore.getState().virtualSets[0].id
    useAppStore.getState().addVirtualSetMember(id, 'layer-1')
    useAppStore.getState().setVirtualSetMemberBlendMode(id, 'layer-1', 'multiply')
    const members = useAppStore.getState().virtualSets[0].members
    expect(members[0].blendMode).toBe('multiply')
  })

  it('setVirtualSetMemberBlendModeでblendModeをnullに戻せる', () => {
    useAppStore.getState().addVirtualSet('セット')
    const id = useAppStore.getState().virtualSets[0].id
    useAppStore.getState().addVirtualSetMember(id, 'layer-1')
    useAppStore.getState().setVirtualSetMemberBlendMode(id, 'layer-1', 'multiply')
    useAppStore.getState().setVirtualSetMemberBlendMode(id, 'layer-1', null)
    const members = useAppStore.getState().virtualSets[0].members
    expect(members[0].blendMode).toBeNull()
  })
})
