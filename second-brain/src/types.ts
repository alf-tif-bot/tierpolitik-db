export type EntityType = 'task' | 'client' | 'project' | 'memory' | 'doc' | 'person'

export type BaseEntity = {
  id: string
  type: EntityType
  title: string
  notes?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export type Task = BaseEntity & {
  type: 'task'
  status: 'open' | 'doing' | 'done'
  due?: string
  priority?: 'low' | 'med' | 'high'
  assignee?: string
}

export type Client = BaseEntity & {
  type: 'client'
}

export type Project = BaseEntity & {
  type: 'project'
}

export type Memory = BaseEntity & {
  type: 'memory'
}

export type Doc = BaseEntity & {
  type: 'doc'
  url?: string
}

export type Person = BaseEntity & {
  type: 'person'
  role?: string
}

export type Entity = Task | Client | Project | Memory | Doc | Person

export type Link = {
  from: string
  to: string
  relation: string
  createdAt: string
}

export type BrainDB = {
  entities: Entity[]
  links: Link[]
}
