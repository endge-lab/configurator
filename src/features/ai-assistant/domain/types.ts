export type AIAdapter = 'anthropic' | 'ollama'
export type AIVisibility = 'public' | 'private'

export interface AIModelProfile {
  id: string
  connectionId: string
  connectionName: string
  adapter: AIAdapter
  providerModelId: string
  displayName: string
  enabled: boolean
  isDefault: boolean
  visibility: AIVisibility
  ownedByMe: boolean
  canManage: boolean
}

export interface AIModelSnapshot {
  profileId: string
  connectionId: string
  adapter: AIAdapter
  providerModelId: string
  displayName: string
}

export interface AICapabilities {
  available: boolean
  canView: boolean
  canRun: boolean
  reason?: string
  adapters: AIAdapter[]
  models: AIModelProfile[]
}

export interface AIConversation {
  id: string
  workspaceId: string
  model: AIModelSnapshot
  archived: boolean
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface AIMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  sequence: number
  createdAt: string
}

export interface AIClarificationCandidate {
  candidateId: string
  documentType: string
  identity: string
  displayName: string
}

export interface AIClarification {
  id: string
  interactionId: string
  taskId: string
  slot: string
  question: string
  candidates: AIClarificationCandidate[]
  planVersion: number
}

export interface AIProviderConnection {
  id: string
  name: string
  adapter: AIAdapter
  baseUrl: string
  hasCredential: boolean
  enabled: boolean
  modelCount: number
  visibility: AIVisibility
  ownedByMe: boolean
  canManage: boolean
}

export interface AICreateConnectionWithModel {
  name: string
  adapter: AIAdapter
  baseUrl: string
  credential: string
  visibility: AIVisibility
  enabled: boolean
  model: {
    providerModelId: string
    displayName: string
    enabled: boolean
    isDefault: boolean
  }
}

export interface AIConnectionWithModel {
  connection: AIProviderConnection
  model: AIModelProfile
}

export interface AIRunEvent {
  type: 'started' | 'content_delta' | 'clarification_required' | 'completed' | 'failed'
  runId?: string
  messageId?: string
  delta?: string
  errorCode?: string
  errorMessage?: string
  interactionId?: string
  clarification?: AIClarification
  createdAt: string
}
