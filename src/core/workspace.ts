import type { ControllerGroup, Enterprise, WorkspaceData } from './types'

export interface WorkspaceCounts {
  enterprises: number
  relations: number
  riskSources: number
  enabledRiskSources: number
  groups: number
}

export function createEmptyWorkspaceData(): WorkspaceData {
  return {
    enterprises: [],
    relations: [],
    riskSources: [],
    groups: [],
  }
}

export function cloneWorkspaceData(data: WorkspaceData): WorkspaceData {
  return {
    enterprises: data.enterprises.map((enterprise) => ({ ...enterprise })),
    relations: data.relations.map((relation) => ({ ...relation })),
    riskSources: data.riskSources.map((source) => ({
      ...source,
      targetEnterpriseIds: [...source.targetEnterpriseIds],
    })),
    groups: data.groups.map((group) => ({
      ...group,
      members: [...group.members],
    })),
  }
}

export function countWorkspaceData(data: WorkspaceData): WorkspaceCounts {
  return {
    enterprises: data.enterprises.length,
    relations: data.relations.length,
    riskSources: data.riskSources.length,
    enabledRiskSources: data.riskSources.filter((source) => source.enabled).length,
    groups: data.groups.length,
  }
}

/** 按企业的 controllerGroup 自动归组；同控不生成关系边。 */
export function buildControllerGroups(
  enterprises: Enterprise[],
): ControllerGroup[] {
  const groups = new Map<string, ControllerGroup>()

  for (const enterprise of enterprises) {
    const controllerId = enterprise.controllerGroup?.trim()
    if (!controllerId) continue

    let group = groups.get(controllerId)
    if (!group) {
      group = { controllerId, members: [] }
      groups.set(controllerId, group)
    }

    group.members.push(enterprise.id)
    if (!group.controllerName && enterprise.controllerName?.trim()) {
      group.controllerName = enterprise.controllerName.trim()
    }
  }

  return Array.from(groups.values())
}
