export interface ChatRequest {
  message: string;
  language: string;
  code: string;
}

export interface ChatResponse {
  reply: string;
}
