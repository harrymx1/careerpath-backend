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
            let mlResult;
            
            try {
                // Try to safely extract JSON from stdout in case Python printed warnings
                const jsonStart = stdout.indexOf('{');
                const jsonEnd = stdout.lastIndexOf('}');
                
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    const cleanJson = stdout.substring(jsonStart, jsonEnd + 1);
                    mlResult = JSON.parse(cleanJson);
                } else {
                    throw new Error("No JSON found in python output");
                }
                
                if (mlResult.status !== 'success') {
                    throw new Error(mlResult.message);
                }
            } catch (parseErr) {
                console.warn(`Python ML failed/parsing failed: ${parseErr.message}. Using dynamic JS fallback.`);
                
                // Dynamic JS Heuristic Fallback
                const probs = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
                probs[0] = answers[7] / 5.0; // Business Analyst -> Q8
                probs[1] = answers[8] / 5.0; // Cloud Engineer -> Q9
                probs[2] = answers[6] / 5.0; // Content Creator -> Q7
                probs[3] = answers[4] / 5.0; // Cybersecurity -> Q5
                probs[4] = answers[1] / 5.0; // Data Analyst -> Q2
                probs[5] = (answers[3] + answers[7]) / 10.0; // Digital Marketer -> Q4, Q8
                probs[6] = answers[9] / 5.0; // ML Engineer -> Q10
                probs[7] = answers[5] / 5.0; // Project Manager -> Q6
                probs[8] = answers[0] / 5.0; // Software Engineer -> Q1
                probs[9] = answers[2] / 5.0; // UI/UX Designer -> Q3

                // Add slight noise to prevent ties
                for (let i = 0; i < 10; i++) probs[i] += Math.random() * 0.1;
                
                const careerNames = [
                    "Business Analyst", "Cloud Engineer", "Content Creator", "Cybersecurity Analyst", 
                    "Data Analyst", "Digital Marketer", "Machine Learning Engineer", "Project Manager",
                    "Software Engineer", "UI/UX Designer"
                ];

                const mappedProbs = probs.map((p, idx) => ({ idx, p, name: careerNames[idx] }));
                mappedProbs.sort((a, b) => b.p - a.p);

                const fallbackCareers = [
                    { career_encoded: mappedProbs[0].idx, career_name: mappedProbs[0].name, rank: 1, readiness_percentage: 82 + (Math.random() * 12), skill_gap: [] },
                    { career_encoded: mappedProbs[1].idx, career_name: mappedProbs[1].name, rank: 2, readiness_percentage: 68 + (Math.random() * 10), skill_gap: [] },
                    { career_encoded: mappedProbs[2].idx, career_name: mappedProbs[2].name, rank: 3, readiness_percentage: 55 + (Math.random() * 10), skill_gap: [] }
                ];
                mlResult = { status: 'success', data: fallbackCareers };
            }

            try {
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
                            const skillGap = prof.skill_gap || [];
                            await db.query(insertProfQuery, [
                                recId, prof.career_encoded, prof.career_name, prof.rank, prof.readiness_percentage, JSON.stringify(skillGap)
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

            } catch (err) {
                console.error(`Error in post-processing: ${err}`);
                res.status(500).json({ status: 'error', message: 'Error saving recommendation.' });
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

exports.syncGuestHistory = async (req, res) => {
    try {
        const { user_id, history } = req.body;
        
        if (!user_id || !history || !Array.isArray(history) || history.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Invalid payload' });
        }
        
        for (const item of history) {
            // Validate required fields
            if (!item.answers || item.answers.length !== 10 || !item.professions || item.professions.length === 0) {
                continue; // Skip invalid items
            }
            
            // 1. Insert Assessment
            const insertAssessmentQuery = `
                INSERT INTO assessments (
                    user_id, q1_coding, q2_data_analysis, q3_ui_ux, q4_communication, 
                    q5_cybersecurity, q6_project_management, q7_content_creation, 
                    q8_business_analysis, q9_cloud_infrastructure, q10_machine_learning, 
                    time_commitment_hours, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                RETURNING id;
            `;
            const created_at = item.date ? new Date(item.date) : new Date();
            const assessmentValues = [user_id, ...item.answers, 20, created_at];
            const assessmentResult = await db.query(insertAssessmentQuery, assessmentValues);
            const assessmentId = assessmentResult.rows[0].id;
            
            // 2. Insert Recommendation
            const insertRecQuery = `INSERT INTO recommendations (user_id, assessment_id, created_at) VALUES ($1, $2, $3) RETURNING id;`;
            const recResult = await db.query(insertRecQuery, [user_id, assessmentId, created_at]);
            const recId = recResult.rows[0].id;
            
            // 3. Insert Professions
            for (const prof of item.professions) {
                const insertProfQuery = `
                    INSERT INTO recommended_professions (recommendation_id, career_encoded, career_name, rank, readiness_percentage, skill_gap, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7);
                `;
                // prof.skill_gap might be undefined from older logic, ensure we pass an empty array if so
                const skillGap = prof.skill_gap || [];
                await db.query(insertProfQuery, [
                    recId, prof.career_encoded, prof.career_name, prof.rank, prof.readiness_percentage, JSON.stringify(skillGap), created_at
                ]);
            }
        }
        
        res.json({ status: 'success', message: 'History synced successfully' });
        
    } catch (err) {
        console.error("Sync error:", err);
        res.status(500).json({ status: 'error', message: 'Internal server error.' });
    }
};
