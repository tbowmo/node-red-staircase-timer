import { NodeAPI } from 'node-red'
import {
    IStairCaseTimerNode,
    IStairCaseTimerProperties,
} from './common'
import { StaircaseTimerRunner } from '../lib/stair-case-timer-runner'

export = (RED: NodeAPI): void => {
    RED.nodes.registerType(
        'stairtimer',
        function (this: IStairCaseTimerNode, props: IStairCaseTimerProperties) {
            RED.nodes.createNode(this, props)

            // Hand off the timer function to the timer object
            this.staircaseTimer = new StaircaseTimerRunner(
                props,
                this,
            )

            this.on('input', (msg, _send, done) => {
                try {
                    this.staircaseTimer.onMessage(msg)
                    done()
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (err: any) {
                    done(err)
                }
            })

            this.on('close', () => {
                this.staircaseTimer.cleanup()
            })
        },
    )
}
