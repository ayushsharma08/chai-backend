import asyncHandler from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/User.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from 'jsonwebtoken'

const generateAccessAndrefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generaterefreshToken()
        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false })
        //as password required will going to be kick in as in the defined model on save.
        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refersh and access token")
    }
}


const registerUser = asyncHandler(async (req, res) => {

    const { username, fullname, email, password } = req.body;
    // if (fullname == "") {
    //     throw new ApiError(400, "FullName is required");
    // }
    if ([fullname, email, username, password].some((field) => field?.trim() === " ")) {
        throw new ApiError(400, "all fields are required")
    }
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, 'User with email or username not existed')
    }
    // console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // console.log(avatarLocalPath)
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")

    }
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken "
    )
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering th4eser")

    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    //req.body->data
    // check username or email
    //find the user
    //password check

    //access and refresh token(generate karo on the basis of the userId 
    // kuki us user ke liye hi to generate kar rahe hai because after 
    // generation- authorization, looking up the status of the user whether he is login or not 
    // and also to trak his movement )


    //send cookie mein in token ko

    const { username, email, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    // Here is an alternative of above code based on logic discussed in video:
    // if (!(username || email)) {
    //     throw new ApiError(400, "username or email is required")

    // }
    const user = await User.findOne({
        $or: [{ username, email }]
    })

    if (!user) {
        throw new ApiError(404, 'User does not exist')
    }
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, 'Invalid user credentails')
    }

    const { accessToken, refreshToken } = await generateAccessAndrefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly: true,
        secured: true,

    }
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged IN SuccessFully"
        ))
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        }, {
        new: true
    }
    )
    const options = {
        httpOnly: true,
        secured: true,
    }
    return res.status(200)
        .clearCookie('accessToken', options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, 'User logged out'))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")

    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOEKN_SECRET)
        const user = await User.findById(decodedToken?._id)

        if (!user) {
            throw new ApiError(401, "Invalid refresh Token")

        }
        if (incomingRefreshToken !== user.refreshToken) {
            throw new ApiError(401, " Refresh token is expired or used")

        }

        const options = {
            httpOnly: true,
            secure: true
        }

        const { accessToken, newRefreshToken } = await generateAccessAndrefreshToken(user._id)

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access Token Refreshed"
                )
            )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refres Token")

    }
})






export { registerUser, loginUser, logoutUser, refreshAccessToken }