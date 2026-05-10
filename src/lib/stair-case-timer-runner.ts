import {
    Node,
    NodeStatusFill,
} from 'node-red'
import { util } from '@node-red/util'
import { IStairCaseTimerProperties } from '../nodes/common'
import {
    ISmallTimerMessage,
} from './interfaces'

export class StaircaseTimerRunner {

    private timeoutTimer: ReturnType<typeof setTimeout> | undefined = undefined
    private updateTimer: ReturnType<typeof setInterval> | undefined = undefined
    private currentUpdateIntervalMs = 5_000
    private currentState = false
    private currentLightLevel = 0
    private disabled = false
    private timeoutWhen = 0

    private readonly topic: string
    private readonly onMsg: string
    private readonly offMsg: string
    private readonly onMsgType: string
    private readonly offMsgType: string
    private readonly maxLight: number
    private readonly delay: number
    private readonly restart: boolean

    constructor(
        configuration: IStairCaseTimerProperties,
        private readonly node: Node,
    ) {
        this.topic = configuration.topic
        this.onMsg = configuration.onMsg
        this.offMsg = configuration.offMsg
        this.onMsgType = configuration.onMsgType
        this.offMsgType = configuration.offMsgType
        this.restart = configuration.restart

        switch (configuration.delayUnit) {
            case 'm':
                this.delay = configuration.delay * 60 * 1000
                break
            case 'h':
                this.delay = configuration.delay * 60 * 60 * 1000
                break
            default:
                this.delay = configuration.delay * 1000
        }

        this.maxLight = configuration.lux
    }

    private adjustUpdateInterval(): void {
        if (!this.currentState) {
            // Stop polling when timer is not active
            if (this.updateTimer) {
                clearInterval(this.updateTimer)
                this.updateTimer = undefined
            }
            return
        }

        const timeLeftMs = this.timeoutWhen - Date.now()
        const newInterval = timeLeftMs > 120_000 ? 60_000 : 5_000

        if (this.currentUpdateIntervalMs === newInterval && this.updateTimer) {
            // Interval hasn't changed and timer is running, nothing to do
            return
        }

        // Clear existing timer if any
        if (this.updateTimer) {
            clearInterval(this.updateTimer)
        }

        // Create timer with the correct interval
        this.currentUpdateIntervalMs = newInterval
        this.updateTimer = setInterval(
            () => { if (this.currentState) this.updateNodeStatus() },
            newInterval,
        )
    }

    private formatTimeLeft(millisecondsRemaining: number): string {
        const secondsRemaining = millisecondsRemaining / 1000
        if (secondsRemaining > 120) {
            return `${(secondsRemaining / 60).toFixed(1)} minutes`
        }
        return `${secondsRemaining.toFixed(0)} seconds`
    }

    private updateNodeStatus() {
        let fill: NodeStatusFill = 'yellow'
        const text: string[] = []

        if (this.currentState) {
            fill = 'green'
            text.push('on')
            text.push(`${this.formatTimeLeft(this.timeoutWhen - Date.now())} left`)
        } else {
            fill = 'red'
            text.push('off')
        }

        if (this.currentLightLevel > this.maxLight || this.disabled) {
            if (this.disabled) {
                text.push('disabled')
            } else {
                text.push(`too bright ${this.currentLightLevel} > ${this.maxLight}`)
            }
            if (!this.currentState) {
                fill = 'grey'
            }
        }

        this.node.status({
            fill,
            shape: 'dot',
            text: text.join(' - '),
        })

        this.adjustUpdateInterval()
    }

    public onMessage(
        incomingMsg: Readonly<ISmallTimerMessage>,
    ): void {
        const lightLevel = incomingMsg.light_sensor !== undefined
            ? Number(incomingMsg.light_sensor)
            : undefined

        if (lightLevel !== undefined) {
            if (Number.isNaN(lightLevel)) {
                throw new Error(`Light_level value "${incomingMsg.light_sensor}" can not be converted to a number`)
            }
            this.currentLightLevel = lightLevel
            this.updateNodeStatus()
            return
        }

        if (incomingMsg.disable !== undefined) {
            this.disabled = !!incomingMsg.disable
            this.updateNodeStatus()
            return
        }

        // If only trigger if payload is truthy, otherwise just update light level or disabled state
        if (!!incomingMsg.payload && (this.restart || !this.currentState)) {
            if (this.currentLightLevel > this.maxLight || this.disabled) {
                this.updateNodeStatus()
                return
            }

            this.timeoutWhen = Date.now() + this.delay
            this.currentState = true
            this.updateNodeStatus()
            this.node.send({
                payload: util.evaluateNodeProperty(this.onMsg, this.onMsgType, this.node, {}),
                topic: this.topic,
            })

            if (this.timeoutTimer) {
                clearTimeout(this.timeoutTimer)
            }

            this.timeoutTimer = setTimeout(() => {
                this.currentState = false
                this.updateNodeStatus()
                this.node.send({
                    payload: util.evaluateNodeProperty(this.offMsg, this.offMsgType, this.node, {}),
                    topic: this.topic,
                })
                this.timeoutTimer = undefined
            }, this.delay)
        }
    }

    public cleanup(): void {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer)
            this.timeoutTimer = undefined
        }
        if (this.updateTimer) {
            clearInterval(this.updateTimer)
            this.updateTimer = undefined
        }
    }
}
