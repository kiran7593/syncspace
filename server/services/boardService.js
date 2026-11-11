
const saveBoard = async (pool, board, revision) => {
  if (
    !board ||
    !Array.isArray(board.nodes) ||
    !Array.isArray(board.edges) ||
    !Number.isInteger(revision) ||
    revision < 1
  ) {
    return {
      success: false,
      status: 400,
      message: "Invalid board data or revision.",
    };
  }

  try {
    const result = await pool.query(
      `UPDATE boards
       SET
         data = $1,
         revision = revision + 1,
         updated_at = NOW()
       WHERE id = 1 AND revision = $2
       RETURNING revision`,
      [board, revision],
    );

    if (result.rows.length === 0) {
      return {
        success: false,
        status: 409,
        message: "Board has changed. Please reload.",
      };
    }

    return {
      success: true,
      revision: result.rows[0].revision,
    };
  } catch (error) {
    console.error("Board save failed:", error);

    return {
      success: false,
      status: 500,
      message: "Could not save board.",
    };
  }
};

module.exports = { saveBoard };
