import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors(); // Mở CORS cho WebSocket test UI

  // Bật Validation (Để class-validator trong DTO hoạt động)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // ========== CẤU HÌNH SWAGGER ==========
  const config = new DocumentBuilder()
    .setTitle('Omnichannel Hub API')
    .setDescription('Tài liệu API cho Hệ thống trung tâm điều phối tin nhắn')
    .setVersion('1.0')
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // UI sẽ nằm ở đường dẫn /api/docs
  // =======================================

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  console.log(`🚀 Server đang chạy tại: http://localhost:${port}`);
  console.log(`📚 Mở Swagger UI tại: http://localhost:${port}/api/docs`);
}
bootstrap();