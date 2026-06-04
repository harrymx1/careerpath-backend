const { exec } = require('child_process');
const path = require('path');
const db = require('../config/db'); // pg pool instance

exports.submitAssessment = async (req, res) => {
    try {
        const { user_id, answers, time_commitment_hours } = req.body;
        // answers should be an array of 10 integers

        if (!answers || answers.length !== 10) {
            return res.status(400).json({ status: 'error', message: 'Invalid input data. 10 answers required.' });
        }

        // 1. Call Python Script for ML Prediction FIRST
        const pythonScriptPath = path.join(__dirname, '../ml_model/predict.py');
        const inputStr = answers.join(',');
        
        exec(`python "${pythonScriptPath}" "${inputStr}"`, async (error, stdout, stderr) => {
            if (error) {
                console.error(`Python script error: ${error}`);
                return res.status(500).json({ status: 'error', message: 'Failed to generate recommendation.' });
            }

            try {
                const mlResult = JSON.parse(stdout);
                if (mlResult.status !== 'success') {
                    throw new Error(mlResult.message);
                }

                // 2. Save recommendation session IF user_id exists
                let assessmentId = null;
                let recId = null;
                
                if (user_id && user_id !== "00000000-0000-0000-0000-000000000000") {
                    try {
                        const insertAssessmentQuery = `
                            INSERT INTO assessments (
                                user_id, q1_coding, q2_data_analysis, q3_ui_ux, q4_communication, 
                                q5_cybersecurity, q6_project_management, q7_content_creation, 
                                q8_business_analysis, q9_cloud_infrastructure, q10_machine_learning, 
                                time_commitment_hours
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                            RETURNING id;
                        `;
                        const assessmentValues = [user_id, ...answers, time_commitment_hours || 0];
                        const assessmentResult = await db.query(insertAssessmentQuery, assessmentValues);
                        assessmentId = assessmentResult.rows[0].id;

                        const insertRecQuery = `INSERT INTO recommendations (user_id, assessment_id) VALUES ($1, $2) RETURNING id;`;
                        const recResult = await db.query(insertRecQuery, [user_id, assessmentId]);
                        recId = recResult.rows[0].id;
                        
                        // Save top 3 professions
                        const professions = mlResult.data;
                        for (const prof of professions) {
                            const insertProfQuery = `
                                INSERT INTO recommended_professions (recommendation_id, career_encoded, career_name, rank, readiness_percentage, skill_gap)
                                VALUES ($1, $2, $3, $4, $5, $6);
                            `;
                            await db.query(insertProfQuery, [
                                recId, prof.career_encoded, prof.career_name, prof.rank, prof.readiness_percentage, JSON.stringify(prof.skill_gap)
                            ]);
                        }
                    } catch (dbErr) {
                        console.warn("Could not save to DB (perhaps invalid user_id). Returning predictions anyway.", dbErr.message);
                    }
                }

                // Return final result
                res.json({
                    status: 'success',
                    data: {
                        assessment_id: assessmentId,
                        recommendation_id: recId,
                        professions: mlResult.data
                    }
                });

            } catch (parseErr) {
                console.error(`Error parsing python output: ${parseErr}, stdout: ${stdout}`);
                res.status(500).json({ status: 'error', message: 'Error processing AI recommendation.' });
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
};

exports.getUserRecommendations = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Fetch recommendations with professions
        const query = `
            SELECT r.id as rec_id, r.created_at, rp.career_name, rp.readiness_percentage, rp.rank
            FROM recommendations r
            JOIN recommended_professions rp ON r.id = rp.recommendation_id
            WHERE r.user_id = $1
            ORDER BY r.created_at DESC, rp.rank ASC
        `;
        const result = await db.query(query, [id]);
        
        res.json({
            status: 'success',
            data: result.rows
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
};
