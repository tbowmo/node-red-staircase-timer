import helper from 'node-red-node-test-helper'
import stairTimer from './stair-timer'
import { expect } from 'chai'
import { useSinonSandbox } from '../test'
import * as runner from '../lib/stair-case-timer-runner'

helper.init(require.resolve('node-red'))

describe('node/stair-timer', () => {
    const sinon = useSinonSandbox()

    // beforeEach(function (done) {
    //     helper.startServer(done)
    // })
  
    afterEach(function () {
        helper.unload()
    })

    function setupStub() {
        const onMessage = sinon.stub().named('onMessage')
        const cleanup = sinon.stub().named('cleanup')
        const mockedInstance = {
            onMessage,
            cleanup,
        }
        return {
            stairCaseTimerRunner: sinon.stub(runner, 'StaircaseTimerRunner').returns(mockedInstance),
            onMessage,
            cleanup,
        }
    }

    it('Should load and initialize node', async () => {
        const stubs = setupStub()
        
        const flow  = [
            { 
                id: 'n1', 
                type: 'stairtimer', 
                name: 'stair-timer', 
                offMsg: '',
                offMsgType: '',
                onMsg: '',
                onMsgType: '',
                topic: '',
            }, 
        ]

        await helper.load(stairTimer, flow)
        await new Promise((resolve, reject) => {
            const n1 = helper.getNode('n1')
            try {
                expect(n1).to.have.property('name').which.equals('stair-timer')
                sinon.assert.calledOnce(stubs.stairCaseTimerRunner)
                sinon.assert.calledWith(stubs.stairCaseTimerRunner, {
                    id: 'n1',
                    type: 'stairtimer',
                    name: 'stair-timer',
                    offMsg: '',
                    offMsgType: '',
                    onMsg: '',
                    onMsgType: '',
                    topic: '',
                    _users: [],                  
                })
                resolve(1)
            } catch(err) {
                reject(err)
            }
        })
    })

    it('should handle incomming message', async () => {
        const stubs = setupStub()

        const flow  = [
            { 
                id: 'n1', 
                type: 'stairtimer', 
                name: 'small-timer', 
                offMsg: '',
                offMsgType: '',
                onMsg: '',
                onMsgType: '',
                topic: '',
            }, 
        ]

        await helper.load(stairTimer, flow)
        await new Promise((resolve, reject) => {
            const n1 = helper.getNode('n1')
            try {
                n1.receive({payload: 'test', _msgid: 'testid'})
                sinon.assert.calledWith(stubs.onMessage, {payload: 'test', _msgid: 'testid'})
                resolve(1)
            } catch (e) {
                reject(e)
            }
        })
    })

    it('should handle return error if runner throws an error', async () => {
        const stubs = setupStub()
        stubs.onMessage.throws(new Error('test error'))

        const flow  = [
            { 
                id: 'n1', 
                type: 'stairtimer', 
                name: 'small-timer', 
                offMsg: '',
                offMsgType: '',
                onMsg: '',
                onMsgType: '',
                topic: '',
            }, 
        ]

        await helper.load(stairTimer, flow)
        await new Promise((resolve, reject) => {
            const n1 = helper.getNode('n1')
            try {
                n1.error = (err) => {
                    expect(err).to.deep.equal(Error('test error'))
                }
                n1.receive({payload: 'test', _msgid: 'testid'})
                resolve(1)
            } catch (e) {
                reject(e)
            }
        })
    })

})
