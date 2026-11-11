// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PledgeLane
/// @notice All-or-nothing crowdfunding with contributor refunds when a target is missed.
contract PledgeLane {
    uint64 public constant MIN_DURATION = 1 days;
    uint64 public constant MAX_DURATION = 90 days;

    struct Campaign {
        address creator;
        string title;
        string description;
        uint256 goal;
        uint64 deadline;
        uint256 raised;
        bool claimed;
        bool cancelled;
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => mapping(address => uint256)) public contributions;
    uint256 private unlocked = 1;

    event CampaignCreated(uint256 indexed campaignId, address indexed creator, uint256 goal, uint64 deadline, string title);
    event ContributionReceived(uint256 indexed campaignId, address indexed contributor, uint256 amount);
    event CampaignClaimed(uint256 indexed campaignId, address indexed creator, uint256 amount);
    event ContributionRefunded(uint256 indexed campaignId, address indexed contributor, uint256 amount);
    event CampaignCancelled(uint256 indexed campaignId);

    error InvalidCampaign();
    error InvalidText();
    error InvalidGoal();
    error InvalidDuration();
    error CampaignClosed();
    error CampaignOpen();
    error TargetNotReached();
    error TargetReached();
    error NotCreator();
    error NothingToRefund();
    error AlreadySettled();
    error TransferFailed();
    error ReentrantCall();

    modifier nonReentrant() {
        if (unlocked != 1) revert ReentrantCall();
        unlocked = 2;
        _;
        unlocked = 1;
    }

    modifier validCampaign(uint256 campaignId) {
        if (campaignId >= campaignCount) revert InvalidCampaign();
        _;
    }

    function createCampaign(
        string calldata title,
        string calldata description,
        uint256 goal,
        uint64 duration
    ) external returns (uint256 campaignId) {
        bytes memory titleBytes = bytes(title);
        bytes memory descriptionBytes = bytes(description);
        if (titleBytes.length == 0 || titleBytes.length > 80 || descriptionBytes.length == 0 || descriptionBytes.length > 700) revert InvalidText();
        if (goal == 0) revert InvalidGoal();
        if (duration < MIN_DURATION || duration > MAX_DURATION) revert InvalidDuration();

        campaignId = campaignCount++;
        uint64 deadline = uint64(block.timestamp) + duration;
        campaigns[campaignId] = Campaign({
            creator: msg.sender,
            title: title,
            description: description,
            goal: goal,
            deadline: deadline,
            raised: 0,
            claimed: false,
            cancelled: false
        });
        emit CampaignCreated(campaignId, msg.sender, goal, deadline, title);
    }

    function contribute(uint256 campaignId) external payable validCampaign(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        if (block.timestamp >= campaign.deadline || campaign.cancelled) revert CampaignClosed();
        if (msg.value == 0) revert InvalidGoal();
        campaign.raised += msg.value;
        contributions[campaignId][msg.sender] += msg.value;
        emit ContributionReceived(campaignId, msg.sender, msg.value);
    }

    function claim(uint256 campaignId) external nonReentrant validCampaign(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        if (msg.sender != campaign.creator) revert NotCreator();
        if (block.timestamp < campaign.deadline) revert CampaignOpen();
        if (campaign.cancelled || campaign.claimed) revert AlreadySettled();
        if (campaign.raised < campaign.goal) revert TargetNotReached();
        campaign.claimed = true;
        uint256 amount = campaign.raised;
        (bool ok, ) = payable(campaign.creator).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit CampaignClaimed(campaignId, campaign.creator, amount);
    }

    function refund(uint256 campaignId) external nonReentrant validCampaign(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        if (!campaign.cancelled && block.timestamp < campaign.deadline) revert CampaignOpen();
        if (!campaign.cancelled && campaign.raised >= campaign.goal) revert TargetReached();
        uint256 amount = contributions[campaignId][msg.sender];
        if (amount == 0) revert NothingToRefund();
        contributions[campaignId][msg.sender] = 0;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit ContributionRefunded(campaignId, msg.sender, amount);
    }

    function cancel(uint256 campaignId) external validCampaign(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        if (msg.sender != campaign.creator) revert NotCreator();
        if (block.timestamp >= campaign.deadline) revert CampaignClosed();
        if (campaign.claimed || campaign.cancelled) revert AlreadySettled();
        campaign.cancelled = true;
        emit CampaignCancelled(campaignId);
    }
}
