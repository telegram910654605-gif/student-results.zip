function parseData(input) {
  try {
    if (typeof input === 'string') {
      const parsed = JSON.parse(input);
      return {
        success: true,
        data: parsed,
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: true,
      data: input,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const result = parseData(req.body);
    res.status(200).json(result);
  } else {
    res.status(200).json({
      message: 'Use POST request to parse data'
    });
  }
};
