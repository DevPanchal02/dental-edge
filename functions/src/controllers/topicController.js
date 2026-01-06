// FILE: functions/src/controllers/topicController.js

const logger = require("firebase-functions/logger");
const topicService = require("../services/topicService");

const getTopics = async (request, response) => {
  logger.info("getTopics function triggered.");
  try {
    const topics = await topicService.getAllTopics();
    response.status(200).json(topics);
  } catch (error) {
    logger.error("Error fetching topics:", error);
    response.status(500).send("Internal Server Error");
  }
};

const getTopicStructure = async (request, response) => {
  const { topicId } = request.query;
  if (!topicId) {
    return response.status(400).send("Bad Request: Missing topicId parameter.");
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

module.exports = {
  getTopics,
  getTopicStructure
};