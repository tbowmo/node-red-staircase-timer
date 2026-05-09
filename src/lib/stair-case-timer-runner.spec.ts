import { expect } from 'chai'
import { useSinonSandbox } from '../test'
import { IStairCaseTimerProperties } from '../nodes/common'
import { StaircaseTimerRunner } from './stair-case-timer-runner'

describe('lib/stair-case-timer-runner', () => {
    const sinon = useSinonSandbox()

    function setupTest(config?: Partial<IStairCaseTimerProperties>) {
        const send = sinon.stub().named('node-send')
        const status = sinon.stub().named('node-status')
        const error = sinon.stub().named('node-error')

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = { send, status, error } as any
        const position = { latitude: 56.00, longitude: 10.00 }
        const configuration: IStairCaseTimerProperties = {
            delay: 1,
            delayUnit: 's',
            lux: 100,
            onMsg: '',
            offMsg: '',
            topic: '',
            offMsgType: 'str',
            onMsgType: 'str',
            id: '',
            type: '',
            name: '',
            z: '',
            ...config,
        }

        return {
            send,
            status,
            node,
            position,
            configuration,
        }
    }

    describe('node status updates', () => {
        it('should update status on light level change', () => {
            const stubs = setupTest()
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)

            runner.onMessage({ light_sensor: 50, _msgid: 'test' })

            expect(stubs.status.called).to.be.true
        })

        it('should update status on disable', () => {
            const stubs = setupTest()
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)

            runner.onMessage({ disable: true, _msgid: 'test' })

            expect(stubs.status.called).to.be.true
        })

        it('should adjust update interval based on time left', function () {
            const stubs = setupTest({ delay: 200, delayUnit: 's' }) // 200 seconds delay
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)
            const clock = sinon.clock

            runner.onMessage({ payload: true, _msgid: 'test' })

            // Initially, time left > 120s, so interval should be 60s
            expect((runner as any).currentUpdateIntervalMs).to.equal(60_000)
            expect((runner as any).updateTimer).to.not.be.undefined

            // Advance time so time left < 120s (e.g., 80s left)
            clock.tick(120_000)

            // Interval should change to 5s
            expect((runner as any).currentUpdateIntervalMs).to.equal(5_000)

            // Advance time past timeout
            clock.tick(100_000)

            // Timer should be off, updateTimer cleared
            expect((runner as any).currentState).to.be.false
            expect((runner as any).updateTimer).to.be.undefined
        })

        it('should not start update timer when timer is not active', () => {
            const stubs = setupTest()
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)

            // No message sent, so currentState is false
            expect((runner as any).currentState).to.be.false
            expect((runner as any).updateTimer).to.be.undefined
        })
    })

    describe('constructor', () => {
        it('should convert delay to milliseconds', () => {
            let stubs = setupTest({ delay: 1, delayUnit: 's' })
            let runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)
            expect((runner as any).delay).to.equal(1000)

            stubs = setupTest({ delay: 1, delayUnit: 'm' })
            runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)
            expect((runner as any).delay).to.equal(60 * 1000)

            stubs = setupTest({ delay: 1, delayUnit: 'h' })
            runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)
            expect((runner as any).delay).to.equal(60 * 60 * 1000)
        })
    })

    describe('message input', () => {
        it('should update light level when light_sensor is provided', () => {
            const stubs = setupTest()
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)

            runner.onMessage({ light_sensor: 50, _msgid: 'test' })

            expect((runner as any).currentLightLevel).to.equal(50)
            expect(stubs.status.called).to.be.true
        })

        it('should throw error for invalid light_sensor value', () => {
            const stubs = setupTest()
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)

            expect(() => runner.onMessage({ light_sensor: 'invalid' as any, _msgid: 'test' })).to.throw('Light_level value "invalid" can not be converted to a number')
        })

        it('should set disabled state when disable is provided', () => {
            const stubs = setupTest()
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)

            runner.onMessage({ disable: true, _msgid: 'test' })

            expect((runner as any).disabled).to.be.true
            expect(stubs.status.called).to.be.true
        })

        it('should start timer and send onMsg when payload is provided and conditions allow', () => {
            const stubs = setupTest({ onMsg: 'ON', onMsgType: 'str' })
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)

            runner.onMessage({ payload: true, _msgid: 'test' })

            expect((runner as any).currentState).to.be.true
            expect(stubs.send.calledOnce).to.be.true
            expect(stubs.send.firstCall.args[0]).to.deep.equal({
                payload: 'ON',
                topic: '',
            })
            expect(stubs.status.called).to.be.true
        })

        it('should not start timer when too bright', () => {
            const stubs = setupTest()
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)

            // Set light level above max
            runner.onMessage({ light_sensor: 150, _msgid: 'test' })
            runner.onMessage({ payload: true, _msgid: 'test' })

            expect((runner as any).currentState).to.be.false
            expect(stubs.send.called).to.be.false
        })

        it('should not start timer when disabled', () => {
            const stubs = setupTest()
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)

            // Disable the timer
            runner.onMessage({ disable: true, _msgid: 'test' })
            runner.onMessage({ payload: true, _msgid: 'test' })

            expect((runner as any).currentState).to.be.false
            expect(stubs.send.called).to.be.false
        })

        it('should send offMsg after timeout', function () {
            const stubs = setupTest({ offMsg: 'OFF', offMsgType: 'str', delay: 0.1, delayUnit: 's' })
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)
            const clock = sinon.clock

            runner.onMessage({ payload: true, _msgid: 'test' })

            // Advance time by delay
            clock.tick(100)

            expect((runner as any).currentState).to.be.false
            expect(stubs.send.calledTwice).to.be.true
            expect(stubs.send.secondCall.args[0]).to.deep.equal({
                payload: 'OFF',
                topic: '',
            })
        })

        it('should clear existing timeout when new payload arrives', () => {
            const stubs = setupTest({ delay: 1, delayUnit: 's' })
            const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)
            const clock = sinon.clock

            runner.onMessage({ payload: true, _msgid: 'test' })
            expect((runner as any).timeoutTimer).to.not.be.undefined
            clock.tick(800)
            // Send another payload before timeout
            runner.onMessage({ payload: true, _msgid: 'test' })

            // Advance time past original timeout
            clock.tick(800)

            // Should still be on since timeout was cleared
            expect((runner as any).currentState).to.be.true
        })
    })

    it('should clear timers on cleanup', () => {
        const stubs = setupTest()
        const runner = new StaircaseTimerRunner(stubs.configuration, stubs.node)

        runner.onMessage({ payload: true, _msgid: 'test' })

        expect((runner as any).timeoutTimer).to.not.be.undefined
        expect((runner as any).updateTimer).to.not.be.undefined

        runner.cleanup()

        expect((runner as any).timeoutTimer).to.be.undefined
        expect((runner as any).updateTimer).to.be.undefined
    })
})
