import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FirebaseService } from '../src/firebase/firebase.service';
import { StripeService } from '../src/stripe/stripe.service';
import { PrismaService } from '../src/prisma/prisma.service';

const fakeFirebase = {
  onModuleInit: () => undefined,
  verifyIdToken: (token: string) => {
    if (token === 'admin-token') {
      return Promise.resolve({ uid: 'admin-uid', email: 'admin@test.com', admin: true });
    }
    if (token === 'customer-token') {
      return Promise.resolve({ uid: 'customer-uid', email: 'customer@test.com' });
    }
    return Promise.reject(new Error('invalid'));
  },
};

const fakeStripe = {
  client: {
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_1',
          url: 'https://stripe.test/cs_test_1',
        }),
      },
    },
    refunds: { create: jest.fn().mockResolvedValue({ id: 're_test_1' }) },
  },
  constructWebhookEvent: (payload: Buffer) =>
    JSON.parse(payload.toString()) as unknown,
};

describe('Ecommerce API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const admin = { Authorization: 'Bearer admin-token' };
  const customer = { Authorization: 'Bearer customer-token' };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FirebaseService)
      .useValue(fakeFirebase)
      .overrideProvider(StripeService)
      .useValue(fakeStripe)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    // clean slate
    await prisma.review.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await prisma.processedStripeEvent.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  let categoryId: string;
  let productId: string;
  let orderId: string;

  it('admin creates a category and product', async () => {
    const cat = await request(app.getHttpServer())
      .post('/categories')
      .set(admin)
      .send({ name: 'Tees', slug: 'tees' })
      .expect(201);
    categoryId = cat.body.id;

    const prod = await request(app.getHttpServer())
      .post('/products')
      .set(admin)
      .send({
        name: 'Chiller Tee',
        slug: 'chiller-tee',
        description: 'Organic cotton tee',
        priceCents: 2500,
        images: ['https://example.com/tee.jpg'],
        stockQty: 10,
        categoryId,
      })
      .expect(201);
    productId = prod.body.id;
  });

  it('customer cannot create products', async () => {
    await request(app.getHttpServer())
      .post('/products')
      .set(customer)
      .send({})
      .expect(403);
  });

  it('public can browse products', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?category=tees')
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].slug).toBe('chiller-tee');
  });

  it('customer checks out and gets a session url', async () => {
    const res = await request(app.getHttpServer())
      .post('/checkout')
      .set(customer)
      .send({ items: [{ productId, quantity: 2 }] })
      .expect(201);
    expect(res.body.url).toBe('https://stripe.test/cs_test_1');
    orderId = res.body.orderId;
  });

  it('webhook marks the order paid and decrements stock', async () => {
    const shippingDetails = {
      name: 'Ship To Person',
      address: { country: 'CA', city: 'Toronto' },
    };
    const event = {
      id: 'evt_e2e_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          metadata: { orderId },
          payment_intent: 'pi_e2e_1',
          amount_total: 5000,
          payment_status: 'paid',
          customer_details: { name: 'Cust Omer', address: { country: 'US' } },
          collected_information: { shipping_details: shippingDetails },
        },
      },
    };
    await request(app.getHttpServer())
      .post('/webhooks/stripe')
      .set('stripe-signature', 'test-sig')
      .set('content-type', 'application/json')
      .send(event)
      .expect(201);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe('PAID');
    expect(order?.shippingAddress).toEqual(shippingDetails);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    expect(product?.stockQty).toBe(8);

    // idempotency: replaying the same event changes nothing
    await request(app.getHttpServer())
      .post('/webhooks/stripe')
      .set('stripe-signature', 'test-sig')
      .set('content-type', 'application/json')
      .send(event)
      .expect(201);
    const productAfter = await prisma.product.findUnique({ where: { id: productId } });
    expect(productAfter?.stockQty).toBe(8);
  });

  it('customer sees the order in their history', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders/me')
      .set(customer)
      .expect(200);
    expect(res.body[0].id).toBe(orderId);
    expect(res.body[0].status).toBe('PAID');
  });

  it('purchaser can review; non-purchaser cannot', async () => {
    await request(app.getHttpServer())
      .post(`/products/${productId}/reviews`)
      .set(customer)
      .send({ rating: 5, text: 'Soft and great' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/products/${productId}/reviews`)
      .set(admin) // admin never bought it
      .send({ rating: 1, text: 'never bought' })
      .expect(403);

    const res = await request(app.getHttpServer())
      .get(`/products/${productId}/reviews`)
      .expect(200);
    expect(res.body.count).toBe(1);
    expect(res.body.averageRating).toBe(5);
  });

  it('admin ships the order', async () => {
    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set(admin)
      .send({ status: 'SHIPPED' })
      .expect(200);
  });
});
