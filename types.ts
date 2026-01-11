
export interface DeviceStream {
  id: string;
  name: string;
  stream: MediaStream;
  connectedAt: number;
  isFocused: boolean;
  quality: 'low' | 'high';
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'candidate' | 'join' | 'identity';
  payload: any;
  from: string;
}
