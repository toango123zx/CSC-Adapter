// src/modules/agent-gateway/agent-gateway.module.ts
import { Module } from '@nestjs/common';
import { AgentGateway } from './agent.gateway';

@Module({
    providers: [AgentGateway],
    exports: [AgentGateway],
})
export class AgentGatewayModule { }
