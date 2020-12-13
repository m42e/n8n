import {
	IExecuteFunctions,
} from 'n8n-core';

import {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import {
	getresponseApiRequest,
	getResponseApiRequestAllItems,
} from './GenericFunctions';

import {
	contactFields,
	contactOperations,
} from './ContactDescription';

import * as moment from 'moment-timezone';

export class GetResponse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'GetResponse',
		name: 'getResponse',
		icon: 'file:getResponse.png',
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Consume GetResponse API.',
		defaults: {
			name: 'GetResponse',
			color: '#00afec',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'getResponseApi',
				required: true,
				displayOptions: {
					show: {
						authentication: [
							'apiKey',
						],
					},
				},
			},
			{
				name: 'getResponseOAuth2Api',
				required: true,
				displayOptions: {
					show: {
						authentication: [
							'oAuth2',
						],
					},
				},
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{
						name: 'API Key',
						value: 'apiKey',
					},
					{
						name: 'OAuth2',
						value: 'oAuth2',
					},
				],
				default: 'apiKey',
				description: 'The resource to operate on.',
			},
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Contact',
						value: 'contact',
					},
				],
				default: 'contact',
				description: 'The resource to operate on.',
			},
			...contactOperations,
			...contactFields,
		],
	};

	methods = {
		loadOptions: {
			// Get all the campaigns to display them to user so that he can
			// select them easily
			async getCampaigns(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const campaigns = await getresponseApiRequest.call(
					this,
					'GET',
					`/campaigns`,
				);
				for (const campaign of campaigns) {
					returnData.push({
						name: campaign.name as string,
						value: campaign.campaignId,
					});
				}
				return returnData;
			},
			// Get all the tagd to display them to user so that he can
			// select them easily
			async getTags(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const tags = await getresponseApiRequest.call(
					this,
					'GET',
					`/tags`,
				);
				for (const tag of tags) {
					returnData.push({
						name: tag.name as string,
						value: tag.tagId,
					});
				}
				return returnData;
			},
			// Get all the custom fields to display them to user so that he can
			// select them easily
			async getCustomFields(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const returnData: INodePropertyOptions[] = [];
				const customFields = await getresponseApiRequest.call(
					this,
					'GET',
					`/custom-fields`,
				);
				for (const customField of customFields) {
					returnData.push({
						name: customField.name as string,
						value: customField.customFieldId,
					});
				}
				return returnData;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: IDataObject[] = [];
		const length = (items.length as unknown) as number;
		const qs: IDataObject = {};
		let responseData;
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		for (let i = 0; i < length; i++) {

			if (resource === 'contact') {
				//https://apireference.getresponse.com/#operation/createContact
				if (operation === 'create') {
					const email = this.getNodeParameter('email', i) as string;

					const campaignId = this.getNodeParameter('campaignId', i) as string;

					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

					const body: IDataObject = {
						email,
						campaign: {
							campaignId,
						},
					};

					Object.assign(body, additionalFields);

					if (additionalFields.customFieldsUi) {
						const customFieldValues = (additionalFields.customFieldsUi as IDataObject).customFieldValues as IDataObject[];
						if (customFieldValues) {
							body.customFieldValues = customFieldValues;
							for (let i = 0; i < customFieldValues.length; i++) {
								if (!Array.isArray(customFieldValues[i].value)) {
									customFieldValues[i].value = [customFieldValues[i].value];
								}
							}
							delete body.customFieldsUi;
						}
					}

					responseData = await getresponseApiRequest.call(this, 'POST', '/contacts', body);

					responseData = { success: true };
				}
				//https://apireference.getresponse.com/?_ga=2.160836350.2102802044.1604719933-1897033509.1604598019#operation/deleteContact
				if (operation === 'delete') {
					const contactId = this.getNodeParameter('contactId', i) as string;

					const options = this.getNodeParameter('options', i) as IDataObject;

					Object.assign(qs, options);

					responseData = await getresponseApiRequest.call(this, 'DELETE', `/contacts/${contactId}`, {}, qs);

					responseData = { success: true };
				}
				//https://apireference.getresponse.com/?_ga=2.160836350.2102802044.1604719933-1897033509.1604598019#operation/getContactById
				if (operation === 'get') {
					const contactId = this.getNodeParameter('contactId', i) as string;

					const options = this.getNodeParameter('options', i) as IDataObject;

					Object.assign(qs, options);

					responseData = await getresponseApiRequest.call(this, 'GET', `/contacts/${contactId}`, {}, qs);
				}
				//https://apireference.getresponse.com/?_ga=2.160836350.2102802044.1604719933-1897033509.1604598019#operation/getContactList
				if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;

					const options = this.getNodeParameter('options', i) as IDataObject;

					const timezone = this.getTimezone();

					Object.assign(qs, options);

					const isNotQuery = [
						'sortBy',
						'sortOrder',
						'additionalFlags',
						'fields',
						'exactMatch',
					];

					const isDate = [
						'createdOnFrom',
						'createdOnTo',
						'changeOnFrom',
						'changeOnTo',
					];

					const dateMapToKey: { [key: string]: string; } = {
						'createdOnFrom': '[createdOn][from]',
						'createdOnTo': '[createdOn][to]',
						'changeOnFrom': '[changeOn][from]',
						'changeOnTo': '[changeOn][to]',
					};

					for (const key of Object.keys(qs)) {
						if (!isNotQuery.includes(key)) {
							if (isDate.includes(key)) {
								qs[`query${dateMapToKey[key]}`] = moment.tz(qs[key], timezone).format('YYYY-MM-DDTHH:mm:ssZZ');
							} else {
								qs[`query[${key}]`] = qs[key];
							}
							delete qs[key];
						}
					}

					if (qs.sortBy) {
						qs[`sort[${qs.sortBy}]`] = qs.sortOrder || 'ASC';
					}

					if (qs.exactMatch === true) {
						qs['additionalFlags'] = 'exactMatch';
						delete qs.exactMatch;
					}

					if (returnAll) {
						responseData = await getResponseApiRequestAllItems.call(this, 'GET', `/contacts`, {}, qs);
					} else {
						qs.perPage = this.getNodeParameter('limit', i) as number;
						responseData = await getresponseApiRequest.call(this, 'GET', `/contacts`, {}, qs);
					}
				}
				//https://apireference.getresponse.com/?_ga=2.160836350.2102802044.1604719933-1897033509.1604598019#operation/updateContact
				if (operation === 'update') {

					const contactId = this.getNodeParameter('contactId', i) as string;

					const updateFields = this.getNodeParameter('updateFields', i) as IDataObject;

					const body: IDataObject = {};

					Object.assign(body, updateFields);

					if (updateFields.customFieldsUi) {
						const customFieldValues = (updateFields.customFieldsUi as IDataObject).customFieldValues as IDataObject[];
						if (customFieldValues) {
							body.customFieldValues = customFieldValues;
							delete body.customFieldsUi;
						}
					}

					responseData = await getresponseApiRequest.call(this, 'POST', `/contacts/${contactId}`, body);
				}
			}
			if (Array.isArray(responseData)) {
				returnData.push.apply(returnData, responseData as IDataObject[]);

			} else if (responseData !== undefined) {
				returnData.push(responseData as IDataObject);
			}
		}
		return [this.helpers.returnJsonArray(returnData)];
	}
}
