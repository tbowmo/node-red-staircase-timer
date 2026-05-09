/* istanbul ignore next */

import { Node, NodeDef } from 'node-red'
import { StaircaseTimerRunner } from '../lib/stair-case-timer-runner'

/* Configuration */


export interface IStairCaseTimerNode extends Node {
    staircaseTimer: StaircaseTimerRunner
}

export interface IStairCaseTimerProperties extends NodeDef {
    onMsg: string,
    onMsgType: string,
    offMsg: string,
    offMsgType: string,
    topic: string,
    delay: number,
    delayUnit: string,
    lux: number,
}
