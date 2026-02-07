import { Request } from 'firebase-functions/v2/https';
import { Response } from 'express';
import * as logger from 'firebase-functions/logger';
import * as topicService from '../services/topicService';

export const getTopics = async (request: Request, response: Response): Promise<void> => {
    logger.info("getTopics function triggered.");
    try {
        const topics = await topicService.getAllTopics();
        response.status(200).json(topics);
    } catch (error) {
        logger.error("Error fetching topics:", error);
        response.status(500).send("Internal Server Error");
    }
};

export const getTopicStructure = async (request: Request, response: Response): Promise<void> => {
    const topicId = request.query.topicId as string;
    
    if (!topicId) {
        response.status(400).send("Bad Request: Missing topicId parameter.");
        return;
    }

    logger.info(`getTopicStructure triggered for topicId: ${topicId}`);
    try {
        const structure = await topicService.getTopicStructure(topicId);
        response.status(200).json(structure);
    } catch (error) {
        logger.error(`Error fetching structure for ${topicId}:`, error);
        response.status(500).send("Internal Server Error");
    }
};