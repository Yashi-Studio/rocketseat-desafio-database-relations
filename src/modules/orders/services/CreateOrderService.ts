import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customerExist = await this.customersRepository.findById(customer_id);

    if (!customerExist) {
      throw new AppError("Customer doesn't exist");
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!existentProducts.length) {
      throw new AppError("Couldn't find any products.");
    }

    const existentProductsIds = existentProducts.map(p => p.id);

    const nonExistentProducts = products.filter(
      product => !existentProductsIds.includes(product.id),
    );

    if (nonExistentProducts.length) {
      throw new AppError(
        `Could not fund product with id ${nonExistentProducts[0].id}`,
      );
    }

    const findProductsWithNoQuantityAvaliable = products.filter(
      product =>
        existentProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithNoQuantityAvaliable.length) {
      throw new AppError(
        `Product with invalid quantity: ${findProductsWithNoQuantityAvaliable[0].id}`,
      );
    }

    const serializerProducst = products.map(p => ({
      product_id: p.id,
      quantity: p.quantity,
      price: existentProducts.filter(ep => ep.id === p.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      products: serializerProducst,
      customer: customerExist,
    });

    const orderProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        existentProducts.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
