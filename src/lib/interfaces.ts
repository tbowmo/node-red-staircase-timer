import { NodeMessage, NodeMessageInFlow } from 'node-red'

export interface ISmallTimerMessage extends NodeMessageInFlow {
    light_sensor?: number,
    disable?: boolean,
}

export type SmallTimerChangeMessage = NodeMessage
