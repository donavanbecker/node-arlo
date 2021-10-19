/* eslint-disable @typescript-eslint/no-explicit-any */
import { Subscription } from './subscription';
import * as Events from './events';
import * as Resources from './resources';
import * as Responses from './responses';

import { Handler } from './clientHandler';

import { RestClient, IRestResponse } from 'typed-rest-client';
import { IHttpClientResponse } from 'typed-rest-client/Interfaces'

/**
 * Client.
 */
export class Client {

  /**
   * Rest client.
   */
  restClient: RestClient;

  /**
   * Handler.
   */
  handler = new Handler('');

  /**
   * Client constructor.
   * @param userAgent User agent.
   * @param baseUrl Base URL.
   */
  constructor(
    private readonly userAgent = 'node-arlo',
    private readonly baseUrl = 'https://myapi.arlo.com/hmsweb'
  ) {
    this.restClient = new RestClient(userAgent, baseUrl, [this.handler]);
  }

  /**
   * Token.
   */
  set token(token: string) {
    this.handler.token = token;
  }

  /**
   * Create login.
   * @param email Email.
   * @param password Password.
   */
  async createLogin(email: string, password: string): Promise<Responses.Login | null> {
    let response: IRestResponse<Responses.Login>;
    try {
      response = await this.restClient.create('login', {
        email: email,
        password: password
      });
    } catch (error: any) {
      throw new Error(error);
    }

    return response.result;
  }

  /**
   * Get devices.
   */
  async getDevices(): Promise<Responses.Devices | null> {
    let response: IRestResponse<Responses.Devices>;
    try {
      response = await this.restClient.get('users/devices');
    } catch (error: any) {
      throw new Error(error);
    }

    return response.result;
  }

  /**
   * Get subscribe.
   */
  async getSubscribe(subscription = new Subscription()): Promise<Subscription> {
    let response: IHttpClientResponse;
    try {
      this.restClient.client.requestOptions.keepAlive = true;
      response = await this.restClient.client.get(`client/subscribe`, {
        acceptHeader: 'text/event-stream',
        queryParameters: {
          params: {
            token: this.handler.token
          }
        }
      });
    } catch (error: any) {
      throw new Error(error);
    } finally {
      this.restClient.client.requestOptions.keepAlive = false;
    }

    response.message.addListener('data', (chunk) => {
      let data: Responses.SubscribeChunkData;
      try {
        data = JSON.parse(chunk.toString().replace(/^event:\s*/, '"event": "').replace(/\s*data:\s*/, '", "data": ')).data;
      } catch (error: any) {
        throw new Error(error);
      }

      if (data.resource) {
        const resources = data.resource.split('/');

        switch (resources[0]) {
          case 'cameras':
            subscription.emit(Events.CAMERAS, data.from, data.properties);
            break;
          case 'modes':
            subscription.emit(Events.MODES, data.from, data.properties);
            break;
          case 'subscriptions':
            subscription.emit(Events.SUBSCRIPTIONS, data.from, data.properties);
            break;
          default:
            subscription.emit(Events.DEFAULT, data.from, data.properties);
        }
      }
    });
    
    response.message.addListener('close', () => {
      this.getSubscribe(subscription);
    });

    return subscription;
  }

  /**
   * Create full frame snapshot.
   * @param resources Resources.
   * @param xCloudId X cloud ID.
   */
  async createFullFrameSnapshot(resources: Resources.FullFrameSnapshot, xCloudId: string): Promise<boolean | null> {
    let response: IRestResponse<Responses.Response>;
    try {
      response = await this.restClient.create('users/devices/fullFrameSnapshot', {}, {
        additionalHeaders: {
          xCloudId: xCloudId
        }
      });
    } catch (error: any) {
      throw new Error(error);
    }

    if (!response.result) return false;

    return response.result.success;
  }

  /**
   * Create notify.
   * @param deviceId Device ID.
   * @param resources Resources.
   * @param xCloudId X cloud ID.
   */
  async createNotify(deviceId: string, resources: Resources.Notify, xCloudId: string): Promise<boolean | null> {
    let response: IRestResponse<Responses.Response>;
    try {
      response = await this.restClient.create(`users/devices/notify/${deviceId}`, resources, {
        additionalHeaders: {
          xCloudId: xCloudId
        }
      });
    } catch (error: any) {
      throw new Error(error);
    }

    if (!response.result) return false;

    return response.result.success;
  }

  /**
   * Create start stream.
   * @param resources Resources.
   * @param xCloudId X cloud ID.
   */
  async createStartStream(resources: Resources.StartStream, xCloudId: string): Promise<Responses.StartStream | null> {
    let response: IRestResponse<Responses.StartStream>;
    try {
      response = await this.restClient.create('users/devices/startStream', resources, {
        additionalHeaders: {
          xCloudId: xCloudId
        }
      })
    } catch (error: any) {
      throw new Error(error);
    }

    return response.result;
  }
}